package com.armakers3d.monitoring.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.monitoring.domain.BackupRecord;
import com.armakers3d.monitoring.repository.BackupRepository;
import com.armakers3d.shared.error.ValidationFailedException;
import java.lang.management.ManagementFactory;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Operational view of the system for the IT officer (RF18, RNF10, RNF11): availability of the API and the database,
 * a few business counters, and the log of the backups of the managed database with their restore tests. Read-only
 * except for registering a backup entry.
 */
@Service
public class MonitoringService {

    private static final Logger log = LoggerFactory.getLogger(MonitoringService.class);
    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.monitoring");
    private static final int RECENT_BACKUPS = 20;
    private static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);

    public record Database(
            boolean available, Long latencyMs, String product, String version, String schemaVersion) {}

    public record Counters(
            long users, long activeProducts, long orders, long openIncidents, long paymentsToReview,
            long pendingQuotations) {}

    public record Memory(long usedMb, long maxMb) {}

    public record SystemStatus(
            String status,
            Instant checkedAt,
            Instant startedAt,
            long uptimeSeconds,
            String javaVersion,
            int processors,
            Memory memory,
            Database database,
            Counters counters,
            Map<String, String> persistence,
            Map<String, Boolean> scheduledJobs) {}

    public enum BackupHealth {
        OK,
        WARNING,
        CRITICAL
    }

    public record BackupOverview(
            BackupHealth health,
            long maxAgeHours,
            Instant lastSuccessfulAt,
            Long hoursSinceLastSuccess,
            Instant lastVerifiedRestoreAt,
            List<BackupRecord> recent) {}

    public record RegisterBackupCommand(
            Instant backupAt,
            BackupRecord.Type type,
            BackupRecord.Result result,
            boolean restoreVerified,
            String detail,
            Long actorId,
            Rol actorRole) {}

    private final BackupRepository backups;
    private final ObjectProvider<JdbcTemplate> jdbcProvider;
    private final Environment environment;
    private final Clock clock;
    private final long backupMaxAgeHours;

    public MonitoringService(
            BackupRepository backups,
            ObjectProvider<JdbcTemplate> jdbcProvider,
            Environment environment,
            Clock clock,
            @Value("${monitoring.backup-max-age-hours:26}") long backupMaxAgeHours) {
        this.backups = backups;
        this.jdbcProvider = jdbcProvider;
        this.environment = environment;
        this.clock = clock;
        this.backupMaxAgeHours = backupMaxAgeHours;
    }

    public SystemStatus status() {
        Instant now = clock.instant();
        var runtime = ManagementFactory.getRuntimeMXBean();
        Runtime rt = Runtime.getRuntime();
        Database db = database();
        Counters counters = db.available() ? counters() : null;

        Map<String, String> persistence = new LinkedHashMap<>();
        for (String feature : List.of("users", "catalog", "orders", "incidents", "payments", "proofs", "quotations", "monitoring")) {
            persistence.put(feature, environment.getProperty("app.persistence." + feature, "memory"));
        }
        Map<String, Boolean> jobs = new LinkedHashMap<>();
        jobs.put("otpAndSessionPurge", environment.getProperty("purge.enabled", Boolean.class, true));
        jobs.put("checkoutExpiry", environment.getProperty("app.payments.expiry-job-enabled", Boolean.class, true));

        boolean usesDatabase = persistence.containsValue("jpa");
        String overall = usesDatabase && !db.available() ? "DOWN" : "UP";
        return new SystemStatus(
                overall,
                now,
                Instant.ofEpochMilli(runtime.getStartTime()),
                runtime.getUptime() / 1000,
                System.getProperty("java.version"),
                rt.availableProcessors(),
                new Memory((rt.totalMemory() - rt.freeMemory()) / (1024 * 1024), rt.maxMemory() / (1024 * 1024)),
                db,
                counters,
                persistence,
                jobs);
    }

    public BackupOverview backupOverview() {
        Instant now = clock.instant();
        Optional<BackupRecord> lastOk = backups.findLatestSuccessful();
        Long hours = lastOk.map(r -> Duration.between(r.backupAt(), now).toHours()).orElse(null);
        BackupHealth health;
        if (lastOk.isEmpty()) {
            health = BackupHealth.CRITICAL;
        } else if (hours > backupMaxAgeHours) {
            health = BackupHealth.WARNING;
        } else {
            health = BackupHealth.OK;
        }
        return new BackupOverview(
                health,
                backupMaxAgeHours,
                lastOk.map(BackupRecord::backupAt).orElse(null),
                hours,
                backups.findLatestVerified().map(BackupRecord::backupAt).orElse(null),
                backups.findRecent(RECENT_BACKUPS));
    }

    public BackupRecord registerBackup(RegisterBackupCommand cmd) {
        Instant now = clock.instant();
        if (cmd.backupAt() == null || cmd.type() == null || cmd.result() == null) {
            throw new ValidationFailedException("backupAt", "backupAt, type and result are required");
        }
        if (cmd.backupAt().isAfter(now.plus(MAX_FUTURE_SKEW))) {
            throw new ValidationFailedException("backupAt", "must not be in the future");
        }
        if (cmd.restoreVerified() && cmd.result() != BackupRecord.Result.EXITOSO) {
            throw new ValidationFailedException("restoreVerified", "only a successful backup can have a verified restore");
        }
        String detail = cmd.detail() == null || cmd.detail().isBlank() ? null : cmd.detail().trim();
        if (detail != null && detail.chars().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) {
            throw new ValidationFailedException("detail", "must not contain control characters");
        }
        BackupRecord saved = backups.save(new BackupRecord(
                null, cmd.backupAt(), cmd.type(), cmd.result(), cmd.restoreVerified(), detail, cmd.actorId(), now));
        audit.info("backup.registered actor={} role={} backup={} type={} result={} restoreVerified={}",
                cmd.actorId(), cmd.actorRole(), saved.id(), saved.type(), saved.result(), saved.restoreVerified());
        return saved;
    }

    // ---------------------------------------------------------------------------------------------------------------

    private Database database() {
        JdbcTemplate jdbc = jdbcProvider.getIfAvailable();
        if (jdbc == null) {
            return new Database(false, null, null, null, null);
        }
        try {
            long start = System.nanoTime();
            jdbc.queryForObject("select 1", Integer.class);
            long latency = (System.nanoTime() - start) / 1_000_000;
            String[] meta = jdbc.execute((ConnectionCallback<String[]>) con -> new String[] {
                con.getMetaData().getDatabaseProductName(), con.getMetaData().getDatabaseProductVersion()
            });
            List<String> schema = jdbc.queryForList(
                    "select \"version\" from \"flyway_schema_history\" where \"success\" order by \"installed_rank\" desc limit 1",
                    String.class);
            return new Database(true, latency, meta[0], meta[1], schema.isEmpty() ? null : schema.get(0));
        } catch (RuntimeException ex) {
            log.warn("monitoring.database.check_failed cause={} message={}", ex.getClass().getSimpleName(), ex.getMessage());
            return new Database(false, null, null, null, null);
        }
    }

    private Counters counters() {
        JdbcTemplate jdbc = jdbcProvider.getObject();
        return new Counters(
                count(jdbc, "select count(*) from usuario"),
                count(jdbc, "select count(*) from producto where estado"),
                count(jdbc, "select count(*) from pedido"),
                count(jdbc, "select count(*) from incidencia where id_estado_incidencia in"
                        + " (select id_estado_incidencia from estado_incidencia where nombre in ('ABIERTA', 'EN_REVISION'))"),
                count(jdbc, "select count(*) from checkout where estado = 'PROOF_SUBMITTED'"),
                count(jdbc, "select count(*) from cotizacion where estado = 'REGISTRADA'"));
    }

    private static long count(JdbcTemplate jdbc, String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0 : value;
    }
}
