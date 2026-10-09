package com.armakers3d.monitoring.controller;

import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.monitoring.domain.BackupRecord;
import com.armakers3d.monitoring.service.MonitoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/monitoring")
@Tag(name = "Monitoring (IT)", description = "System status and backup log (RESPONSABLE_TI, ADMINISTRADOR).")
public class AdminMonitoringController {

    /** Body of {@code POST /api/admin/monitoring/backups}. */
    public record RegisterBackupRequest(
            @NotNull Instant backupAt,
            @NotNull BackupRecord.Type type,
            @NotNull BackupRecord.Result result,
            boolean restoreVerified,
            @Size(max = 500, message = "must be at most 500 characters") String detail) {}

    private final MonitoringService service;

    public AdminMonitoringController(MonitoringService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "System status",
            description = "Availability of the API and the database, uptime, memory, storage mode of each module,"
                    + " scheduled jobs and a few business counters (no personal data).")
    public MonitoringService.SystemStatus status() {
        return service.status();
    }

    @GetMapping("/backups")
    @Operation(
            summary = "Backup overview",
            description = "Health of the backups (OK / WARNING when the last successful one is older than the allowed"
                    + " age / CRITICAL when there is none), the last verified restore and the latest 20 log entries.")
    public MonitoringService.BackupOverview backups() {
        return service.backupOverview();
    }

    @PostMapping("/backups")
    @Operation(
            summary = "Register a backup or a restore test in the log",
            description = "Body: backupAt, type (AUTOMATICO|MANUAL), result (EXITOSO|FALLIDO), restoreVerified (only for"
                    + " a successful backup) and an optional detail (max 500).")
    public ResponseEntity<BackupRecord> registerBackup(
            @AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody RegisterBackupRequest request) {
        BackupRecord saved = service.registerBackup(new MonitoringService.RegisterBackupCommand(
                request.backupAt(), request.type(), request.result(), request.restoreVerified(), request.detail(),
                actor.id(), actor.rol()));
        return ResponseEntity.created(URI.create("/api/admin/monitoring/backups")).body(saved);
    }
}
