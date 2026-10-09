package com.armakers3d.orders.infrastructure.jpa;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.OrderKind;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA mapping of table {@code pedido} with its {@code detalle_pedido} lines and {@code historial_estado_pedido}
 * entries (V6). Infrastructure only; the domain model is the immutable {@code Order} record.
 */
@Entity
@Table(name = "pedido")
public class PedidoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pedido")
    private Long id;

    @Column(name = "codigo_pedido", nullable = false, length = 30, unique = true)
    private String code;

    @Column(name = "id_cliente", nullable = false)
    private Long customerId;

    @Column(name = "id_cotizacion")
    private Long quotationId;

    @Column(name = "id_estado_pedido", nullable = false)
    private Long statusId;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private OrderKind kind;

    @Column(name = "fecha_pedido", nullable = false)
    private Instant createdAt;

    @Column(name = "total", precision = 10, scale = 2)
    private BigDecimal total;

    @Column(name = "registrado_por")
    private Long registeredBy;

    @Column(name = "entrega_direccion", length = 200)
    private String deliveryAddress;

    @Column(name = "entrega_distrito", length = 80)
    private String deliveryDistrict;

    @Column(name = "entrega_notas", length = 300)
    private String deliveryNotes;

    @Column(name = "contacto_nombre", length = 150)
    private String contactName;

    @Column(name = "contacto_telefono", length = 20)
    private String contactPhone;

    @Column(name = "id_checkout", length = 36, unique = true)
    private String checkoutId;

    @Column(name = "referencia_pago", length = 30)
    private String paymentReference;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_pedido", nullable = false)
    @OrderBy("id ASC")
    private List<Detalle> lines = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_pedido", nullable = false)
    @OrderBy("id ASC")
    private List<Historial> history = new ArrayList<>();

    protected PedidoEntity() {
    }

    PedidoEntity(
            String code,
            Long customerId,
            Long quotationId,
            Long statusId,
            OrderKind kind,
            Instant createdAt,
            BigDecimal total,
            Long registeredBy,
            String deliveryAddress,
            String deliveryDistrict,
            String deliveryNotes,
            String contactName,
            String contactPhone,
            String checkoutId,
            String paymentReference) {
        this.code = code;
        this.customerId = customerId;
        this.quotationId = quotationId;
        this.statusId = statusId;
        this.kind = kind;
        this.createdAt = createdAt;
        this.total = total;
        this.registeredBy = registeredBy;
        this.deliveryAddress = deliveryAddress;
        this.deliveryDistrict = deliveryDistrict;
        this.deliveryNotes = deliveryNotes;
        this.contactName = contactName;
        this.contactPhone = contactPhone;
        this.checkoutId = checkoutId;
        this.paymentReference = paymentReference;
    }

    Long getId() {
        return id;
    }

    String getCode() {
        return code;
    }

    Long getCustomerId() {
        return customerId;
    }

    Long getStatusId() {
        return statusId;
    }

    void setStatusId(Long statusId) {
        this.statusId = statusId;
    }

    OrderKind getKind() {
        return kind;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    Long getRegisteredBy() {
        return registeredBy;
    }

    String getDeliveryAddress() {
        return deliveryAddress;
    }

    String getDeliveryDistrict() {
        return deliveryDistrict;
    }

    String getDeliveryNotes() {
        return deliveryNotes;
    }

    String getContactName() {
        return contactName;
    }

    String getContactPhone() {
        return contactPhone;
    }

    String getCheckoutId() {
        return checkoutId;
    }

    String getPaymentReference() {
        return paymentReference;
    }

    List<Detalle> getLines() {
        return lines;
    }

    List<Historial> getHistory() {
        return history;
    }

    /** JPA mapping of table {@code detalle_pedido}. */
    @Entity
    @Table(name = "detalle_pedido")
    public static class Detalle {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id_detalle_pedido")
        private Long id;

        @Column(name = "id_producto")
        private Long productId;

        @Column(name = "descripcion")
        private String title;

        @Column(name = "cantidad", nullable = false)
        private int quantity;

        @Column(name = "precio_unitario", nullable = false, precision = 10, scale = 2)
        private BigDecimal unitPrice;

        @Column(name = "subtotal", nullable = false, precision = 10, scale = 2)
        private BigDecimal subtotal;

        protected Detalle() {
        }

        Detalle(Long productId, String title, int quantity, BigDecimal unitPrice, BigDecimal subtotal) {
            this.productId = productId;
            this.title = title;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
            this.subtotal = subtotal;
        }

        Long getProductId() {
            return productId;
        }

        String getTitle() {
            return title;
        }

        int getQuantity() {
            return quantity;
        }

        BigDecimal getUnitPrice() {
            return unitPrice;
        }
    }

    /** JPA mapping of table {@code historial_estado_pedido}. */
    @Entity
    @Table(name = "historial_estado_pedido")
    public static class Historial {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id_historial")
        private Long id;

        @Column(name = "id_estado_pedido", nullable = false)
        private Long statusId;

        @Column(name = "id_estado_anterior")
        private Long previousStatusId;

        @Column(name = "fecha_cambio", nullable = false)
        private Instant changedAt;

        @Column(name = "observacion")
        private String note;

        @Column(name = "id_usuario_responsable")
        private Long actorId;

        @Enumerated(EnumType.STRING)
        @Column(name = "rol_responsable", length = 20)
        private Rol actorRole;

        protected Historial() {
        }

        Historial(Long statusId, Long previousStatusId, Instant changedAt, String note, Long actorId, Rol actorRole) {
            this.statusId = statusId;
            this.previousStatusId = previousStatusId;
            this.changedAt = changedAt;
            this.note = note;
            this.actorId = actorId;
            this.actorRole = actorRole;
        }

        Long getStatusId() {
            return statusId;
        }

        Long getPreviousStatusId() {
            return previousStatusId;
        }

        Instant getChangedAt() {
            return changedAt;
        }

        String getNote() {
            return note;
        }

        Long getActorId() {
            return actorId;
        }

        Rol getActorRole() {
            return actorRole;
        }
    }
}
