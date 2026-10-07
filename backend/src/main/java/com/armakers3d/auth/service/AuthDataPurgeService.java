package com.armakers3d.auth.service;

import com.armakers3d.auth.repository.AuthenticatedSessionRepository;
import com.armakers3d.auth.repository.CodigoOtpRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Retention purge for security tables (DB-06, ADR-004 5.6 / security review R2): one-time codes issued more than
 * 24 hours ago and sessions that expired or were revoked more than 24 hours ago. Nothing else is deleted, so a
 * valid session or a code that can still matter is never touched. Logs counts only (no emails, no ids). The
 * trigger lives in {@link AuthDataPurgeScheduler}; this class holds the rule so tests can call it with a fixed clock.
 */
@Service
public class AuthDataPurgeService {

    /** Rows older than this are purged. */
    public static final Duration RETENTION = Duration.ofHours(24);

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.auth");

    private final CodigoOtpRepository otpRepository;
    private final AuthenticatedSessionRepository sessionRepository;
    private final Clock clock;

    public AuthDataPurgeService(
            CodigoOtpRepository otpRepository, AuthenticatedSessionRepository sessionRepository, Clock clock) {
        this.otpRepository = otpRepository;
        this.sessionRepository = sessionRepository;
        this.clock = clock;
    }

    /** Result of one run, for tests. */
    public record PurgeResult(int otpCodes, int sessions) {}

    public PurgeResult purge() {
        Instant cutoff = clock.instant().minus(RETENTION);
        int codes = otpRepository.deleteIssuedBefore(cutoff);
        int sessions = sessionRepository.deleteExpiredOrRevokedBefore(cutoff);
        audit.info("auth.purge.completed otpCodes={} sessions={}", codes, sessions);
        return new PurgeResult(codes, sessions);
    }
}
