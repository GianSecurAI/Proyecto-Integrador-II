package com.armakers3d.payments.infrastructure.jpa;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutLine;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.repository.CheckoutRepository;
import com.armakers3d.shared.persistence.PedidoRefEntity;
import com.armakers3d.shared.persistence.PedidoRefRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link CheckoutRepository} over {@code checkout}, {@code checkout_linea} and
 * {@code comprobante_pago}. Selected by {@code app.persistence.payments=jpa}.
 *
 * <p>The cap on open checkouts per customer is enforced by locking the customer's {@code usuario} row for the duration of
 * the count-and-insert, so concurrent inserts of one customer queue behind each other. The status compare-and-set locks
 * the checkout row.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.payments", havingValue = "jpa")
public class JpaCheckoutRepositoryAdapter implements CheckoutRepository {

    private final CheckoutJpaRepository jpa;
    private final PedidoRefRepository orders;
    private final JdbcTemplate jdbc;

    public JpaCheckoutRepositoryAdapter(CheckoutJpaRepository jpa, PedidoRefRepository orders, JdbcTemplate jdbc) {
        this.jpa = jpa;
        this.orders = orders;
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Checkout> findById(String id) {
        return jpa.findById(id).map(JpaCheckoutRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional
    public boolean insertIfOpenBelow(Checkout checkout, int maxOpen, Instant now) {
        jdbc.query("select id_usuario from usuario where id_usuario = ? for update", rs -> {}, checkout.customerId());
        if (jpa.countOpenOf(checkout.customerId(), now) >= maxOpen) {
            return false;
        }
        jpa.saveAndFlush(insert(checkout));
        return true;
    }

    @Override
    @Transactional
    public boolean replaceIfStatus(Checkout updated, CheckoutStatus expected) {
        Optional<CheckoutEntity> locked = jpa.findByIdForUpdate(updated.id());
        if (locked.isEmpty() || locked.get().getStatus() != expected) {
            return false;
        }
        CheckoutEntity entity = locked.get();
        entity.update(updated.status(), orderRef(updated.orderId()), updated.paidAt(), updated.approvedBy());
        syncAttempts(entity, updated.attempts());
        jpa.save(entity);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Checkout> findAwaitingProofExpiredAt(Instant now) {
        return jpa.findByStatusAndExpiresAtLessThanEqual(CheckoutStatus.AWAITING_PAYMENT_PROOF, now).stream()
                .map(JpaCheckoutRepositoryAdapter::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Checkout> findByStatus(CheckoutStatus status) {
        return jpa.findByStatus(status).stream().map(JpaCheckoutRepositoryAdapter::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> findCheckoutIdsByProofHash(String sha256) {
        return Set.copyOf(jpa.findIdsByProofHash(sha256));
    }

    // ---------------------------------------------------------------------------------------------------------------

    private CheckoutEntity insert(Checkout c) {
        DeliveryInfo delivery = c.delivery();
        ContactInfo contact = c.contact();
        CheckoutEntity entity = new CheckoutEntity(
                c.id(),
                c.customerId(),
                c.status(),
                c.createdAt(),
                c.expiresAt(),
                delivery == null ? null : delivery.address(),
                delivery == null ? null : delivery.district(),
                delivery == null ? null : delivery.notes(),
                contact == null ? null : contact.fullName(),
                contact == null ? null : contact.phone());
        int position = 0;
        for (CheckoutLine line : c.lines()) {
            entity.getLines()
                    .add(new CheckoutEntity.Linea(
                            position++, line.productId(), line.title(), line.unitPrice(), line.quantity()));
        }
        entity.update(c.status(), orderRef(c.orderId()), c.paidAt(), c.approvedBy());
        syncAttempts(entity, c.attempts());
        return entity;
    }

    /** Updates the decision of the attempts already stored and appends the ones added since. */
    private static void syncAttempts(CheckoutEntity entity, List<ProofAttempt> attempts) {
        List<CheckoutEntity.Comprobante> stored = entity.getAttempts();
        for (int i = 0; i < attempts.size(); i++) {
            ProofAttempt a = attempts.get(i);
            if (i < stored.size()) {
                stored.get(i).decide(a.decision(), a.decidedBy(), a.decidedAt(), a.rejectionReason());
            } else {
                stored.add(new CheckoutEntity.Comprobante(
                        a.id(),
                        a.number(),
                        a.method(),
                        a.operationCode(),
                        a.storageKey(),
                        a.type(),
                        a.sizeBytes(),
                        a.sha256(),
                        a.submittedAt(),
                        a.decision(),
                        a.decidedBy(),
                        a.decidedAt(),
                        a.rejectionReason()));
            }
        }
    }

    private PedidoRefEntity orderRef(String orderCode) {
        if (orderCode == null) {
            return null;
        }
        return orders.findByCode(orderCode).orElseThrow(() -> new IllegalStateException("Unknown order " + orderCode));
    }

    private static Checkout toDomain(CheckoutEntity e) {
        List<CheckoutLine> lines = e.getLines().stream()
                .map(l -> new CheckoutLine(l.getProductId(), l.getTitle(), l.getUnitPrice(), l.getQuantity()))
                .toList();
        List<ProofAttempt> attempts = e.getAttempts().stream()
                .map(a -> new ProofAttempt(
                        a.getId(),
                        a.getNumber(),
                        a.getMethod(),
                        a.getOperationCode(),
                        a.getStorageKey(),
                        a.getType(),
                        a.getSizeBytes(),
                        a.getSha256(),
                        a.getSubmittedAt(),
                        a.getDecision(),
                        a.getDecidedBy(),
                        a.getDecidedAt(),
                        a.getRejectionReason()))
                .toList();
        boolean hasDelivery = e.getDeliveryAddress() != null
                || e.getDeliveryDistrict() != null
                || e.getDeliveryNotes() != null;
        boolean hasContact = e.getContactName() != null || e.getContactPhone() != null;
        return new Checkout(
                e.getId(),
                e.getCustomerId(),
                e.getStatus(),
                lines,
                hasDelivery
                        ? new DeliveryInfo(e.getDeliveryAddress(), e.getDeliveryDistrict(), e.getDeliveryNotes())
                        : null,
                hasContact ? new ContactInfo(e.getContactName(), e.getContactPhone()) : null,
                e.getCreatedAt(),
                e.getExpiresAt(),
                attempts,
                e.getOrder() == null ? null : e.getOrder().getCode(),
                e.getPaidAt(),
                e.getApprovedBy());
    }
}
