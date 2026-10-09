package com.armakers3d.payments.infrastructure.jpa;

import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofDecision;
import com.armakers3d.payments.domain.ProofImageType;
import com.armakers3d.shared.persistence.PedidoRefEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA mapping of table {@code checkout} (V7) with its {@code checkout_linea} lines and {@code comprobante_pago} proof
 * attempts. Infrastructure only; the domain model is the immutable {@code Checkout} record.
 */
@Entity
@Table(name = "checkout")
public class CheckoutEntity {

    @Id
    @Column(name = "id_checkout", length = 36)
    private String id;

    @Column(name = "id_cliente", nullable = false)
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 30)
    private CheckoutStatus status;

    @Column(name = "fecha_creacion", nullable = false)
    private Instant createdAt;

    @Column(name = "fecha_expiracion", nullable = false)
    private Instant expiresAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_pedido")
    private PedidoRefEntity order;

    @Column(name = "fecha_pago")
    private Instant paidAt;

    @Column(name = "aprobado_por")
    private Long approvedBy;

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

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_checkout", nullable = false)
    @OrderBy("position ASC")
    private List<Linea> lines = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "id_checkout", nullable = false)
    @OrderBy("number ASC")
    private List<Comprobante> attempts = new ArrayList<>();

    protected CheckoutEntity() {
    }

    CheckoutEntity(
            String id,
            Long customerId,
            CheckoutStatus status,
            Instant createdAt,
            Instant expiresAt,
            String deliveryAddress,
            String deliveryDistrict,
            String deliveryNotes,
            String contactName,
            String contactPhone) {
        this.id = id;
        this.customerId = customerId;
        this.status = status;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.deliveryAddress = deliveryAddress;
        this.deliveryDistrict = deliveryDistrict;
        this.deliveryNotes = deliveryNotes;
        this.contactName = contactName;
        this.contactPhone = contactPhone;
    }

    /** Applies the parts of a checkout that change after it is created (status, order link, payment data). */
    void update(CheckoutStatus status, PedidoRefEntity order, Instant paidAt, Long approvedBy) {
        this.status = status;
        this.order = order;
        this.paidAt = paidAt;
        this.approvedBy = approvedBy;
    }

    String getId() {
        return id;
    }

    Long getCustomerId() {
        return customerId;
    }

    CheckoutStatus getStatus() {
        return status;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    PedidoRefEntity getOrder() {
        return order;
    }

    Instant getPaidAt() {
        return paidAt;
    }

    Long getApprovedBy() {
        return approvedBy;
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

    List<Linea> getLines() {
        return lines;
    }

    List<Comprobante> getAttempts() {
        return attempts;
    }

    /** JPA mapping of table {@code checkout_linea}. */
    @Entity
    @Table(name = "checkout_linea")
    public static class Linea {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id_checkout_linea")
        private Long id;

        @Column(name = "orden", nullable = false)
        private int position;

        @Column(name = "id_producto")
        private Long productId;

        @Column(name = "titulo", nullable = false, length = 150)
        private String title;

        @Column(name = "precio_unitario", nullable = false, precision = 10, scale = 2)
        private BigDecimal unitPrice;

        @Column(name = "cantidad", nullable = false)
        private int quantity;

        protected Linea() {
        }

        Linea(int position, Long productId, String title, BigDecimal unitPrice, int quantity) {
            this.position = position;
            this.productId = productId;
            this.title = title;
            this.unitPrice = unitPrice;
            this.quantity = quantity;
        }

        Long getProductId() {
            return productId;
        }

        String getTitle() {
            return title;
        }

        BigDecimal getUnitPrice() {
            return unitPrice;
        }

        int getQuantity() {
            return quantity;
        }
    }

    /** JPA mapping of table {@code comprobante_pago}: one uploaded payment proof and the administrator's decision on it. */
    @Entity
    @Table(name = "comprobante_pago")
    public static class Comprobante {

        @Id
        @Column(name = "id_comprobante", length = 36)
        private String id;

        @Column(name = "numero", nullable = false)
        private int number;

        @Enumerated(EnumType.STRING)
        @Column(name = "metodo", nullable = false, length = 10)
        private PaymentMethod method;

        @Column(name = "codigo_operacion", length = 20)
        private String operationCode;

        @Column(name = "clave_almacenamiento", nullable = false, length = 100)
        private String storageKey;

        @Enumerated(EnumType.STRING)
        @Column(name = "tipo_imagen", nullable = false, length = 20)
        private ProofImageType type;

        @Column(name = "tamano_bytes", nullable = false)
        private long sizeBytes;

        @Column(name = "sha256", nullable = false, length = 64)
        private String sha256;

        @Column(name = "fecha_envio", nullable = false)
        private Instant submittedAt;

        @Enumerated(EnumType.STRING)
        @Column(name = "decision", nullable = false, length = 10)
        private ProofDecision decision;

        @Column(name = "decidido_por")
        private Long decidedBy;

        @Column(name = "fecha_decision")
        private Instant decidedAt;

        @Column(name = "motivo_rechazo", length = 500)
        private String rejectionReason;

        protected Comprobante() {
        }

        Comprobante(
                String id,
                int number,
                PaymentMethod method,
                String operationCode,
                String storageKey,
                ProofImageType type,
                long sizeBytes,
                String sha256,
                Instant submittedAt,
                ProofDecision decision,
                Long decidedBy,
                Instant decidedAt,
                String rejectionReason) {
            this.id = id;
            this.number = number;
            this.method = method;
            this.operationCode = operationCode;
            this.storageKey = storageKey;
            this.type = type;
            this.sizeBytes = sizeBytes;
            this.sha256 = sha256;
            this.submittedAt = submittedAt;
            this.decision = decision;
            this.decidedBy = decidedBy;
            this.decidedAt = decidedAt;
            this.rejectionReason = rejectionReason;
        }

        /** Applies the administrator's decision on this proof. */
        void decide(ProofDecision decision, Long decidedBy, Instant decidedAt, String rejectionReason) {
            this.decision = decision;
            this.decidedBy = decidedBy;
            this.decidedAt = decidedAt;
            this.rejectionReason = rejectionReason;
        }

        String getId() {
            return id;
        }

        int getNumber() {
            return number;
        }

        PaymentMethod getMethod() {
            return method;
        }

        String getOperationCode() {
            return operationCode;
        }

        String getStorageKey() {
            return storageKey;
        }

        ProofImageType getType() {
            return type;
        }

        long getSizeBytes() {
            return sizeBytes;
        }

        String getSha256() {
            return sha256;
        }

        Instant getSubmittedAt() {
            return submittedAt;
        }

        ProofDecision getDecision() {
            return decision;
        }

        Long getDecidedBy() {
            return decidedBy;
        }

        Instant getDecidedAt() {
            return decidedAt;
        }

        String getRejectionReason() {
            return rejectionReason;
        }
    }
}
