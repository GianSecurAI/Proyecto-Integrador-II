package com.armakers3d.orders.infrastructure.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/** JPA mapping of table {@code idempotencia_pedido} (V7): the resource (checkout or order) created for a customer's Idempotency-Key. */
@Entity
@Table(name = "idempotencia_pedido")
@IdClass(IdempotenciaPedidoEntity.Key.class)
public class IdempotenciaPedidoEntity {

    @Id
    @Column(name = "id_cliente")
    private Long customerId;

    @Id
    @Column(name = "clave", length = 100)
    private String key;

    @Column(name = "huella", nullable = false, length = 64)
    private String fingerprint;

    @Column(name = "id_recurso", nullable = false, length = 36)
    private String resourceId;

    @Column(name = "fecha_creacion", nullable = false)
    private Instant createdAt;

    @Column(name = "fecha_expiracion", nullable = false)
    private Instant expiresAt;

    protected IdempotenciaPedidoEntity() {
    }

    IdempotenciaPedidoEntity(
            Long customerId, String key, String fingerprint, String resourceId, Instant createdAt, Instant expiresAt) {
        this.customerId = customerId;
        this.key = key;
        this.fingerprint = fingerprint;
        this.resourceId = resourceId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    String getFingerprint() {
        return fingerprint;
    }

    String getResourceId() {
        return resourceId;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    /** Composite primary key (id_cliente, clave). */
    public static class Key implements Serializable {
        private Long customerId;
        private String key;

        public Key() {
        }

        Key(Long customerId, String key) {
            this.customerId = customerId;
            this.key = key;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(customerId, other.customerId) && Objects.equals(key, other.key);
        }

        @Override
        public int hashCode() {
            return Objects.hash(customerId, key);
        }
    }
}
