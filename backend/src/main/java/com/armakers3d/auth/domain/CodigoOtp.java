package com.armakers3d.auth.domain;

import java.time.Instant;

/**
 * One issued one-time code (data-model.md: Entity CodigoOTP), a plain domain object. Keyed by
 * email, not by Cliente id, because a code must exist and be verifiable before any account
 * exists (FR-005). Stores only {@code codeHash}, a salted one-way hash, never the plaintext code
 * (FR-002, FR-014). A null {@code id} means "not persisted yet". Instances handed out by a
 * repository are snapshots: mutating one has no effect until it is saved.
 */
public class CodigoOtp {

    private final Long id;
    private final String email;
    private final String codeHash;
    private final Instant issuedAt;
    private final Instant expiresAt;
    private final Instant usedAt;
    private final int attemptCount;
    private CodigoOtpStatus status;

    public CodigoOtp(String email, String codeHash, Instant issuedAt, Instant expiresAt) {
        this(null, email, codeHash, issuedAt, expiresAt, null, 0, CodigoOtpStatus.PENDING);
    }

    /** Restores a persisted code. */
    public CodigoOtp(
            Long id,
            String email,
            String codeHash,
            Instant issuedAt,
            Instant expiresAt,
            Instant usedAt,
            int attemptCount,
            CodigoOtpStatus status) {
        this.id = id;
        this.email = email;
        this.codeHash = codeHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
        this.attemptCount = attemptCount;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public CodigoOtpStatus getStatus() {
        return status;
    }

    public void markSuperseded() {
        this.status = CodigoOtpStatus.SUPERSEDED;
    }

    public void markExpired() {
        this.status = CodigoOtpStatus.EXPIRED;
    }

    public boolean isExpiredAt(Instant now) {
        return now.isAfter(expiresAt);
    }
}
