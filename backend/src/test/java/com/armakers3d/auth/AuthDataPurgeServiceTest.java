package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryAuthenticatedSessionRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryCodigoOtpRepository;
import com.armakers3d.auth.service.AuthDataPurgeScheduler;
import com.armakers3d.auth.service.AuthDataPurgeService;
import com.armakers3d.testsupport.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/** DB-06: the daily purge rule with a fixed clock (the repositories' own contract tests cover each adapter). */
class AuthDataPurgeServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T12:00:00Z");

    private MutableClock clock;
    private InMemoryCodigoOtpRepository otps;
    private InMemoryAuthenticatedSessionRepository sessions;
    private AuthDataPurgeService service;
    private ListAppender<ILoggingEvent> logs;
    private Logger logger;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(NOW, java.time.ZoneId.of("UTC"));
        otps = new InMemoryCodigoOtpRepository();
        sessions = new InMemoryAuthenticatedSessionRepository();
        service = new AuthDataPurgeService(otps, sessions, clock);
        logger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.auth");
        logs = new ListAppender<>();
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(logs);
    }

    private void code(String email, Instant issuedAt) {
        otps.save(new CodigoOtp(email, "hash", issuedAt, issuedAt.plusSeconds(600)));
    }

    @Test
    void deletesCodesOlderThan24HoursAndKeepsRecentOnes() {
        code("old@example.test", NOW.minus(Duration.ofHours(24)).minusSeconds(1));
        code("old@example.test", NOW.minus(Duration.ofHours(30)));
        code("recent@example.test", NOW.minus(Duration.ofHours(23)));
        code("fresh@example.test", NOW);

        var result = service.purge();

        assertThat(result.otpCodes()).isEqualTo(2);
        assertThat(otps.findLatestByEmail("old@example.test")).isEmpty();
        assertThat(otps.findLatestByEmail("recent@example.test")).isPresent();
        assertThat(otps.findLatestByEmail("fresh@example.test")).isPresent();
    }

    @Test
    void deletesSessionsExpiredOrRevokedMoreThan24HoursAgoButNeverActiveOnes() {
        Instant old = NOW.minus(Duration.ofHours(48));
        sessions.save(new AuthenticatedSession("expired-long-ago", 1L, Rol.CLIENTE, old, old.plusSeconds(3600)));
        AuthenticatedSession revokedLongAgo = new AuthenticatedSession("revoked-long-ago", 1L, Rol.CLIENTE, old, NOW.plus(Duration.ofHours(5)));
        revokedLongAgo.revoke(old.plusSeconds(10));
        sessions.save(revokedLongAgo);
        sessions.save(new AuthenticatedSession("expired-recently", 1L, Rol.CLIENTE, NOW.minus(Duration.ofHours(30)),
                NOW.minus(Duration.ofHours(2))));
        AuthenticatedSession revokedRecently = new AuthenticatedSession("revoked-recently", 1L, Rol.CLIENTE, old, NOW.plus(Duration.ofHours(5)));
        revokedRecently.revoke(NOW.minus(Duration.ofHours(1)));
        sessions.save(revokedRecently);
        sessions.save(new AuthenticatedSession("active", 1L, Rol.CLIENTE, NOW, NOW.plus(Duration.ofHours(24))));

        var result = service.purge();

        assertThat(result.sessions()).isEqualTo(2);
        assertThat(sessions.findById("expired-long-ago")).isEmpty();
        assertThat(sessions.findById("revoked-long-ago")).isEmpty();
        assertThat(sessions.findById("expired-recently")).isPresent();
        assertThat(sessions.findById("revoked-recently")).isPresent();
        assertThat(sessions.findById("active")).isPresent();
    }

    @Test
    void theCutoffMovesWithTheClockAndRunsAreIdempotent() {
        code("a@example.test", NOW);

        assertThat(service.purge().otpCodes()).isZero();
        clock.advance(Duration.ofHours(25));
        assertThat(service.purge().otpCodes()).isEqualTo(1);
        assertThat(service.purge().otpCodes()).isZero();
    }

    @Test
    void theJobLogsCountsOnlyNoEmailsNoTokens() {
        code("secret-person@example.test", NOW.minus(Duration.ofDays(3)));
        sessions.save(new AuthenticatedSession("super-secret-token", 7L, Rol.CLIENTE, NOW.minus(Duration.ofDays(3)),
                NOW.minus(Duration.ofDays(2))));

        service.purge();

        assertThat(logs.list).hasSize(1);
        String line = logs.list.get(0).getFormattedMessage();
        assertThat(line).isEqualTo("auth.purge.completed otpCodes=1 sessions=1");
        assertThat(line).doesNotContain("secret").doesNotContain("example.test");
    }

    @Test
    void theSchedulerSwallowsFailuresSoTheNextDayStillRuns() {
        var failing = new AuthDataPurgeService(otps, sessions, clock) {
            @Override
            public PurgeResult purge() {
                throw new IllegalStateException("db down");
            }
        };

        new AuthDataPurgeScheduler(failing).run(); // must not throw
    }
}
