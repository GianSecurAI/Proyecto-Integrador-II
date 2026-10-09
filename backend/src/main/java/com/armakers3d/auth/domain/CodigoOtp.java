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
    private final RegistrationProfile registrationProfile;

    /** Profile data typed in the registration form, applied to the account if this code creates it. */
    public record RegistrationProfile(String firstName, String lastName, String phone) {
        public static RegistrationProfile ofNullable(String firstName, String lastName, String phone) {
            if (isBlank(firstName) && isBlank(lastName) && isBlank(phone)) {
                return null;
            }
            return new RegistrationProfile(trimToNull(firstName), trimToNull(lastName), trimToNull(phone));
        }

        private static boolean isBlank(String v) {
            return v == null || v.isBlank();
        }

        private static String trimToNull(String v) {
            return isBlank(v) ? null : v.trim();
        }
    }

    public CodigoOtp(String email, String codeHash, Instant issuedAt, Instant expiresAt) {
        this(null, email, codeHash, issuedAt, expiresAt, null, 0, CodigoOtpStatus.PENDING, null);
    }

    public CodigoOtp(
            String email, String codeHash, Instant issuedAt, Instant expiresAt, RegistrationProfile registrationProfile) {
        this(null, email, codeHash, issuedAt, expiresAt, null, 0, CodigoOtpStatus.PENDING, registrationProfile);
    }

    public CodigoOtp(
            Long id,
            String email,
            String codeHash,
            Instant issuedAt,
            Instant expiresAt,
            Instant usedAt,
            int attemptCount,
            CodigoOtpStatus status) {
        this(id, email, codeHash, issuedAt, expiresAt, usedAt, attemptCount, status, null);
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
            CodigoOtpStatus status,
            RegistrationProfile registrationProfile) {
        this.id = id;
        this.email = email;
        this.codeHash = codeHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
        this.attemptCount = attemptCount;
        this.status = status;
        this.registrationProfile = registrationProfile;
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

    public RegistrationProfile getRegistrationProfile() {
        return registrationProfile;
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
