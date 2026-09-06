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
 * Customer account (data-model.md: Entity Cliente). Created automatically on first successful
 * OTP verification for a previously unseen email (FR-005). {@code email} is always stored
 * normalized to lower-case by the service layer, which is what makes the plain unique
 * constraint in V1__create_cliente_table.sql effectively case-insensitive (see migration
 * comment) — this entity itself does not re-derive normalization, to avoid duplicating that rule
 * in two places (Prohibited Practices #3).
 */
@Entity
@Table(name = "cliente")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 20)
    private Rol rol = Rol.CLIENTE;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    protected Cliente() {
        // JPA
    }

    public Cliente(String email, Instant createdAt) {
        this.email = email;
        this.createdAt = createdAt;
        this.rol = Rol.CLIENTE;
        this.active = true;
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
