package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.Rol;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code cliente} (V1). Infrastructure only; never leaves this package. */
@Entity
@Table(name = "cliente")
public class ClienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 20)
    private Rol rol;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "active", nullable = false)
    private boolean active;

    protected ClienteEntity() {
        // JPA
    }

    ClienteEntity(Long id, String email, Rol rol, Instant createdAt, boolean active) {
        this.id = id;
        this.email = email;
        this.rol = rol;
        this.createdAt = createdAt;
        this.active = active;
    }

    Long getId() {
        return id;
    }

    String getEmail() {
        return email;
    }

    Rol getRol() {
        return rol;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    boolean isActive() {
        return active;
    }
}
