package com.armakers3d.auth.domain;

import java.time.Instant;

/**
 * Account (data-model.md: Entity Cliente), a plain domain object with no persistence
 * annotations. Created automatically as {@link Rol#CLIENTE} on first successful OTP
 * verification for a previously unseen email (FR-005); staff accounts are provisioned through
 * {@link #provisioned}. {@code email} is always stored normalized to lower-case by the service
 * layer (see OtpService), which is what makes the plain unique constraint effectively
 * case-insensitive. Immutable; a null {@code id} means "not persisted yet".
 */
public final class Cliente {

    private final Long id;
    private final String email;
    private final Rol rol;
    private final Instant createdAt;
    private final boolean active;

    /** Restores a persisted account. */
    public Cliente(Long id, String email, Rol rol, Instant createdAt, boolean active) {
        this.id = id;
        this.email = email;
        this.rol = rol;
        this.createdAt = createdAt;
        this.active = active;
    }

    /** A new self-registered customer (always {@link Rol#CLIENTE}, active, not yet persisted). */
    public Cliente(String email, Instant createdAt) {
        this(null, email, Rol.CLIENTE, createdAt, true);
    }

    /** A new staff (or any-role) account created by provisioning, never by self-registration. */
    public static Cliente provisioned(String email, Rol rol, Instant createdAt) {
        return new Cliente(null, email, rol, createdAt, true);
    }

    /** Copy with another role (accounts are immutable); used by administrator role changes. */
    public Cliente withRol(Rol newRol) {
        return new Cliente(id, email, newRol, createdAt, active);
    }

    /** Copy with another active flag (accounts are immutable); used by (de)activation. */
    public Cliente withActive(boolean newActive) {
        return new Cliente(id, email, rol, createdAt, newActive);
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public Rol getRol() {
        return rol;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isActive() {
        return active;
    }
}
