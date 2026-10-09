package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.Rol;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code usuario} (V1, renamed and aligned with the document model in V6). Infrastructure only; never leaves this package. */
@Entity
@Table(name = "usuario")
public class ClienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Long id;

    @Column(name = "correo", nullable = false, unique = true)
    private String email;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "id_rol", nullable = false)
    private RolEntity rol;

    @Column(name = "fecha_registro", nullable = false)
    private Instant createdAt;

    @Column(name = "estado", nullable = false)
    private boolean active;

    protected ClienteEntity() {
        // JPA
    }

    ClienteEntity(Long id, String email, RolEntity rol, Instant createdAt, boolean active) {
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
        return Rol.valueOf(rol.getNombre());
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    boolean isActive() {
        return active;
    }
}
