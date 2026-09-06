package com.armakers3d.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Server-side session record (data-model.md: Entity AuthenticatedSession; research.md #3). The
 * id itself is the opaque token referenced by the session cookie — there is no separate
 * surrogate key, since the token must already be unguessable and unique.
 */
@Entity
@Table(name = "authenticated_session")
public class AuthenticatedSession {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "cliente_id", nullable = false)
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

    protected AuthenticatedSession() {
        // JPA
    }

    public AuthenticatedSession(String id, Long clienteId, Rol rol, Instant createdAt, Instant expiresAt) {
        this.id = id;
        this.clienteId = clienteId;
        this.rol = rol;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getId() {
        return id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public Rol getRol() {
        return rol;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void revoke(Instant now) {
        this.revokedAt = now;
    }

    public boolean isValidAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }
}
