package com.armakers3d.auth.domain;

import java.time.Instant;

/**
 * Server-side session record (data-model.md: Entity AuthenticatedSession; research.md #3), a
 * plain domain object. The id itself is the opaque token referenced by the session cookie; there
 * is no separate surrogate key, since the token must already be unguessable and unique.
 */
public class AuthenticatedSession {

    private final String id;
    private final Long clienteId;
    private final Rol rol;
    private final Instant createdAt;
    private final Instant expiresAt;
    private Instant revokedAt;

    public AuthenticatedSession(String id, Long clienteId, Rol rol, Instant createdAt, Instant expiresAt) {
        this(id, clienteId, rol, createdAt, expiresAt, null);
    }

    /** Restores a persisted session. */
    public AuthenticatedSession(
            String id, Long clienteId, Rol rol, Instant createdAt, Instant expiresAt, Instant revokedAt) {
        this.id = id;
        this.clienteId = clienteId;
        this.rol = rol;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.revokedAt = revokedAt;
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
        if (this.revokedAt == null) {
            this.revokedAt = now;
        }
    }

    public boolean isValidAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }
}
