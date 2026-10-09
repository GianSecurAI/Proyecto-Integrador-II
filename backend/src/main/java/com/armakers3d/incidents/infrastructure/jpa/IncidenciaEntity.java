package com.armakers3d.incidents.infrastructure.jpa;

import com.armakers3d.shared.persistence.PedidoRefEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code incidencia} (V6). Infrastructure only; the domain model is the {@code Incident} record. */
@Entity
@Table(name = "incidencia")
public class IncidenciaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_incidencia")
    private Long id;

    @Column(name = "codigo_incidencia", nullable = false, length = 30, unique = true)
    private String code;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "id_pedido", nullable = false)
    private PedidoRefEntity order;

    @Column(name = "id_cliente", nullable = false)
    private Long customerId;

    @Column(name = "id_prioridad", nullable = false)
    private Long priorityId;

    @Column(name = "id_estado_incidencia", nullable = false)
    private Long statusId;

    @Column(name = "descripcion", nullable = false)
    private String description;

    @Column(name = "fecha_registro", nullable = false)
    private Instant createdAt;

    @Column(name = "resolucion")
    private String resolution;

    @Column(name = "fecha_cierre")
    private Instant resolvedAt;

    @Column(name = "fecha_actualizacion", nullable = false)
    private Instant updatedAt;

    protected IncidenciaEntity() {
    }

    IncidenciaEntity(
            String code,
            PedidoRefEntity order,
            Long customerId,
            Long priorityId,
            Long statusId,
            String description,
            Instant createdAt,
            String resolution,
            Instant resolvedAt,
            Instant updatedAt) {
        this.code = code;
        this.order = order;
        this.customerId = customerId;
        this.priorityId = priorityId;
        this.statusId = statusId;
        this.description = description;
        this.createdAt = createdAt;
        this.resolution = resolution;
        this.resolvedAt = resolvedAt;
        this.updatedAt = updatedAt;
    }

    /** Applies the parts of an incident that change after it is opened. */
    void update(Long priorityId, Long statusId, String resolution, Instant resolvedAt, Instant updatedAt) {
        this.priorityId = priorityId;
        this.statusId = statusId;
        this.resolution = resolution;
        this.resolvedAt = resolvedAt;
        this.updatedAt = updatedAt;
    }

    String getCode() {
        return code;
    }

    PedidoRefEntity getOrder() {
        return order;
    }

    Long getCustomerId() {
        return customerId;
    }

    Long getPriorityId() {
        return priorityId;
    }

    Long getStatusId() {
        return statusId;
    }

    String getDescription() {
        return description;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    String getResolution() {
        return resolution;
    }

    Instant getResolvedAt() {
        return resolvedAt;
    }

    Instant getUpdatedAt() {
        return updatedAt;
    }
}
