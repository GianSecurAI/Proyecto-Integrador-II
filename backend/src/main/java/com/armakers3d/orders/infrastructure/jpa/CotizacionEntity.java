package com.armakers3d.orders.infrastructure.jpa;

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
 * JPA mapping of table {@code cotizacion} (+ {@code detalle_cotizacion}). A personalized order registered by an advisor
 * after the external payment keeps the quotation that was agreed over WhatsApp: description and agreed amount, stored
 * as an accepted quotation linked one-to-one to the order (ADR-004 D-14). The system never computes the amount.
 */
@Entity
@Table(name = "cotizacion")
public class CotizacionEntity {

    static final String ACCEPTED = "ACEPTADA";

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

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_cotizacion", nullable = false)
    private List<Detalle> details = new ArrayList<>();

    protected CotizacionEntity() {
    }

    CotizacionEntity(Long customerId, String description, BigDecimal agreedAmount, int quantity, Instant quotedAt) {
        this.customerId = customerId;
        this.description = description;
        this.agreedAmount = agreedAmount;
        this.status = ACCEPTED;
        this.quotedAt = quotedAt;
        this.details.add(new Detalle(description, quantity));
    }

    Long getId() {
        return id;
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
