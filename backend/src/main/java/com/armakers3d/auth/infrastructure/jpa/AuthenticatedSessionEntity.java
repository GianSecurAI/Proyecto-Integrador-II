package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.Rol;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code authenticated_session} (V3). The id is the opaque cookie token. */
@Entity
@Table(name = "authenticated_session")
public class AuthenticatedSessionEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "usuario_id", nullable = false)
    private Long clienteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 20)
    private Rol rol;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected AuthenticatedSessionEntity() {
        // JPA
    }

    AuthenticatedSessionEntity(
            String id, Long clienteId, Rol rol, Instant createdAt, Instant expiresAt, Instant revokedAt) {
        this.id = id;
        this.clienteId = clienteId;
        this.rol = rol;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.revokedAt = revokedAt;
    }

    String getId() {
        return id;
    }

    Long getClienteId() {
        return clienteId;
    }

    Rol getRol() {
        return rol;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    Instant getRevokedAt() {
        return revokedAt;
    }
}
