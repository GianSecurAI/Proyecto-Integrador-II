package com.armakers3d.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One issued one-time code (data-model.md: Entity CodigoOTP). Keyed by email, not by Cliente id,
 * because a code must exist and be verifiable before any Cliente row exists (FR-005). Stores
 * only {@code codeHash}, a salted one-way hash — never the plaintext code (FR-002, FR-014).
 */
@Entity
@Table(name = "codigo_otp")
public class CodigoOtp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CodigoOtpStatus status = CodigoOtpStatus.PENDING;

    protected CodigoOtp() {
        // JPA
    }

    public CodigoOtp(String email, String codeHash, Instant issuedAt, Instant expiresAt) {
        this.email = email;
        this.codeHash = codeHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.attemptCount = 0;
        this.status = CodigoOtpStatus.PENDING;
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

    public void markVerified(Instant now) {
        this.status = CodigoOtpStatus.VERIFIED;
        this.usedAt = now;
    }

    public void incrementAttemptCount() {
        this.attemptCount++;
    }

    public boolean isExpiredAt(Instant now) {
        return now.isAfter(expiresAt);
    }
}
