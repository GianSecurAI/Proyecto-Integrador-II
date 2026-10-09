package com.armakers3d.shared.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA mapping of table {@code cotizacion} (+ {@code detalle_cotizacion}): the price agreed with the customer over
 * WhatsApp (never computed by the system, ADR-004 D-14). Shared by the quotations module (register / update) and the
 * orders module (a personalized order registered directly keeps an accepted quotation linked one-to-one).
 */
@Entity
@Table(name = "cotizacion")
public class CotizacionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cotizacion")
    private Long id;

    @Column(name = "id_cliente", nullable = false)
    private Long customerId;

    @Column(name = "descripcion", nullable = false)
    private String description;

    @Column(name = "precio_acordado", nullable = false, precision = 10, scale = 2)
    private BigDecimal agreedAmount;

    @Column(name = "estado", nullable = false, length = 30)
    private String status;

    @Column(name = "fecha_cotizacion", nullable = false)
    private Instant quotedAt;

    @Column(name = "observaciones")
    private String notes;

    @Column(name = "registrado_por")
    private Long registeredBy;

    @Column(name = "fecha_actualizacion")
    private Instant updatedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_cotizacion", nullable = false)
    private List<Detalle> details = new ArrayList<>();

    protected CotizacionEntity() {
    }

    public CotizacionEntity(
            Long customerId,
            String description,
            BigDecimal agreedAmount,
            String status,
            Instant quotedAt,
            String notes,
            Long registeredBy) {
        this.customerId = customerId;
        this.description = description;
        this.agreedAmount = agreedAmount;
        this.status = status;
        this.quotedAt = quotedAt;
        this.notes = notes;
        this.registeredBy = registeredBy;
        this.updatedAt = quotedAt;
        this.details.add(new Detalle(description, 1));
    }

    /** Applies a status change and the notes that explain it. */
    public void changeStatus(String status, String notes, Instant updatedAt) {
        this.status = status;
        this.notes = notes;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getAgreedAmount() {
        return agreedAmount;
    }

    public String getStatus() {
        return status;
    }

    public Instant getQuotedAt() {
        return quotedAt;
    }

    public String getNotes() {
        return notes;
    }

    public Long getRegisteredBy() {
        return registeredBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt == null ? quotedAt : updatedAt;
    }

    /** JPA mapping of table {@code detalle_cotizacion}. */
    @Entity
    @Table(name = "detalle_cotizacion")
    public static class Detalle {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id_detalle_cotizacion")
        private Long id;

        @Column(name = "descripcion_personalizacion", nullable = false)
        private String customization;

        @Column(name = "cantidad", nullable = false)
        private int quantity;

        protected Detalle() {
        }

        Detalle(String customization, int quantity) {
            this.customization = customization;
            this.quantity = quantity;
        }
    }
}
