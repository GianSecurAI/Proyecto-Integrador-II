package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.CodigoOtpStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code codigo_otp} (V2). Stores only the salted hash, never the code. */
@Entity
@Table(name = "codigo_otp")
public class CodigoOtpEntity {

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
    private int attemptCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CodigoOtpStatus status;

    protected CodigoOtpEntity() {
        // JPA
    }

    CodigoOtpEntity(
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

    Long getId() {
        return id;
    }

    String getEmail() {
        return email;
    }

    String getCodeHash() {
        return codeHash;
    }

    Instant getIssuedAt() {
        return issuedAt;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    Instant getUsedAt() {
        return usedAt;
    }

    int getAttemptCount() {
        return attemptCount;
    }

    CodigoOtpStatus getStatus() {
        return status;
    }
}
