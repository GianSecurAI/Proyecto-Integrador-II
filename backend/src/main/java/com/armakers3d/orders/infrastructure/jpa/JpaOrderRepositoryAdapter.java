package com.armakers3d.orders.infrastructure.jpa;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.domain.StatusHistoryEntry;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.shared.persistence.CotizacionEntity;
import com.armakers3d.shared.persistence.LookupTable;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * PostgreSQL-backed {@link OrderRepository} over {@code pedido}, {@code detalle_pedido},
 * {@code historial_estado_pedido} and, for personalized orders, {@code cotizacion}. Selected by
 * {@code app.persistence.orders=jpa}.
 *
 * <p>The public order code ({@code PED-000001}) comes from the sequence {@code seq_codigo_pedido}. The status
 * compare-and-set locks the order row ({@code SELECT ... FOR UPDATE}), so two concurrent transitions of one order cannot
 * both succeed; the one-order-per-checkout guarantee rests on the unique index of {@code pedido.id_checkout}.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.orders", havingValue = "jpa")
public class JpaOrderRepositoryAdapter implements OrderRepository {

    private final PedidoJpaRepository jpa;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LookupTable statuses;

    @PersistenceContext
    private EntityManager em;

    public JpaOrderRepositoryAdapter(PedidoJpaRepository jpa, JdbcTemplate jdbc, PlatformTransactionManager txManager) {
        this.jpa = jpa;
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(txManager);
        this.statuses = new LookupTable(jdbc, "estado_pedido", "id_estado_pedido", "nombre");
    }

    @Override
    public String nextOrderNumber() {
        Long next = jdbc.queryForObject("select nextval('seq_codigo_pedido')", Long.class);
        return String.format("PED-%06d", next);
    }

    @Override
    @Transactional
    public Order save(Order order) {
        Optional<PedidoEntity> existing = jpa.findByCode(order.id());
        PedidoEntity entity = existing.map(e -> sync(e, order)).orElseGet(() -> insert(order));
        return toDomain(jpa.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findById(String id) {
        return jpa.findByCode(id).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Order> findByCustomerId(Long customerId) {
        return jpa.findByCustomerIdOrderByCreatedAtDescCodeDesc(customerId).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Order> search(OrderSearchCriteria criteria, OrderSort sort, PageRequest pageRequest) {
        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<PedidoEntity> countRoot = count.from(PedidoEntity.class);
        count.select(cb.count(countRoot)).where(predicates(cb, countRoot, criteria));
        long total = em.createQuery(count).getSingleResult();

        CriteriaQuery<PedidoEntity> query = cb.createQuery(PedidoEntity.class);
        Root<PedidoEntity> root = query.from(PedidoEntity.class);
        query.select(root)
                .where(predicates(cb, root, criteria))
                .orderBy(
                        sort.descending()
                                ? List.of(cb.desc(root.get("createdAt")), cb.desc(root.get("code")))
                                : List.of(cb.asc(root.get("createdAt")), cb.asc(root.get("code"))));
        List<Order> content = em.createQuery(query)
                .setFirstResult((int) pageRequest.offset())
                .setMaxResults(pageRequest.size())
                .getResultList()
                .stream()
                .map(this::toDomain)
                .toList();

        int totalPages = (int) ((total + pageRequest.size() - 1L) / pageRequest.size());
        return new Page<>(content, pageRequest.page(), pageRequest.size(), total, totalPages);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findByCheckoutId(String checkoutId) {
        return jpa.findByCheckoutId(checkoutId).map(this::toDomain);
    }

    @Override
    public boolean insertIfCheckoutAbsent(Order order) {
        if (order.checkoutId() == null) {
            throw new IllegalArgumentException("An order created for a checkout needs a checkoutId");
        }
        try {
            return Boolean.TRUE.equals(tx.execute(status -> {
                if (jpa.existsByCheckoutId(order.checkoutId())) {
                    return false;
                }
                jpa.saveAndFlush(insert(order));
                return true;
            }));
        } catch (DataIntegrityViolationException raced) {
            return false; // another request inserted the order of this checkout between the check and the insert
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Order> findByQuotationId(Long quotationId) {
        return jpa.findByQuotationId(quotationId).map(this::toDomain);
    }

    @Override
    public boolean insertIfQuotationAbsent(Order order) {
        if (order.quotationId() == null) {
            throw new IllegalArgumentException("An order created from a quotation needs a quotationId");
        }
        try {
            return Boolean.TRUE.equals(tx.execute(status -> {
                if (jpa.existsByQuotationId(order.quotationId())) {
                    return false;
                }
                jpa.saveAndFlush(insert(order));
                return true;
            }));
        } catch (DataIntegrityViolationException raced) {
            return false; // another request generated the order of this quotation between the check and the insert
        }
    }

    @Override
    @Transactional
    public boolean replaceIfStatus(Order updated, OrderStatus expectedCurrent) {
        Optional<PedidoEntity> locked = jpa.findByCodeForUpdate(updated.id());
        if (locked.isEmpty() || !statuses.idOf(expectedCurrent).equals(locked.get().getStatusId())) {
            return false;
        }
        jpa.save(sync(locked.get(), updated));
        return true;
    }

    // ---------------------------------------------------------------------------------------------------------------

    private PedidoEntity insert(Order order) {
        Long quotationId = order.quotationId();
        if (quotationId == null && order.kind() == OrderKind.PERSONALIZADO) {
            // registered directly after the external payment: keep the agreed price as an accepted quotation
            OrderLine line = order.lines().get(0);
            CotizacionEntity quotation = new CotizacionEntity(
                    order.customerId(),
                    line.title(),
                    line.unitPrice(),
                    "ACEPTADA",
                    order.createdAt(),
                    null,
                    order.registeredBy());
            em.persist(quotation);
            quotationId = quotation.getId();
        }
        DeliveryInfo delivery = order.delivery();
        ContactInfo contact = order.contact();
        PedidoEntity entity = new PedidoEntity(
                order.id(),
                order.customerId(),
                quotationId,
                statuses.idOf(order.status()),
                order.kind(),
                order.createdAt(),
                order.total(),
                order.registeredBy(),
                delivery == null ? null : delivery.address(),
                delivery == null ? null : delivery.district(),
                delivery == null ? null : delivery.notes(),
                contact == null ? null : contact.fullName(),
                contact == null ? null : contact.phone(),
                order.checkoutId(),
                order.paymentReference());
        for (OrderLine line : order.lines()) {
            entity.getLines()
                    .add(new PedidoEntity.Detalle(
                            line.productId(), line.title(), line.quantity(), line.unitPrice(), line.lineTotal()));
        }
        appendHistory(entity, order);
        return entity;
    }

    /** Applies the only mutable parts of an order: its status and the history entries appended since it was stored. */
    private PedidoEntity sync(PedidoEntity entity, Order order) {
        entity.setStatusId(statuses.idOf(order.status()));
        appendHistory(entity, order);
        return entity;
    }

    private void appendHistory(PedidoEntity entity, Order order) {
        List<StatusHistoryEntry> entries = order.history();
        for (int i = entity.getHistory().size(); i < entries.size(); i++) {
            StatusHistoryEntry entry = entries.get(i);
            entity.getHistory()
                    .add(new PedidoEntity.Historial(
                            statuses.idOf(entry.toStatus()),
                            entry.fromStatus() == null ? null : statuses.idOf(entry.fromStatus()),
                            entry.at(),
                            entry.note(),
                            entry.actorId(),
                            entry.actorRole()));
        }
    }

    private Order toDomain(PedidoEntity e) {
        List<OrderLine> lines = e.getLines().stream()
                .map(l -> new OrderLine(l.getProductId(), l.getTitle(), l.getUnitPrice(), l.getQuantity()))
                .toList();
        List<StatusHistoryEntry> history = e.getHistory().stream()
                .map(h -> new StatusHistoryEntry(
                        h.getPreviousStatusId() == null
                                ? null
                                : statuses.valueOf(OrderStatus.class, h.getPreviousStatusId()),
                        statuses.valueOf(OrderStatus.class, h.getStatusId()),
                        h.getActorId(),
                        h.getActorRole(),
                        h.getChangedAt(),
                        h.getNote()))
                .toList();
        boolean hasDelivery = e.getDeliveryAddress() != null
                || e.getDeliveryDistrict() != null
                || e.getDeliveryNotes() != null;
        boolean hasContact = e.getContactName() != null || e.getContactPhone() != null;
        return new Order(
                e.getCode(),
                e.getCustomerId(),
                e.getKind(),
                statuses.valueOf(OrderStatus.class, e.getStatusId()),
                lines,
                hasDelivery
                        ? new DeliveryInfo(e.getDeliveryAddress(), e.getDeliveryDistrict(), e.getDeliveryNotes())
                        : null,
                hasContact ? new ContactInfo(e.getContactName(), e.getContactPhone()) : null,
                e.getCreatedAt(),
                e.getRegisteredBy(),
                history,
                e.getCheckoutId(),
                e.getPaymentReference(),
                e.getQuotationId());
    }

    private Predicate[] predicates(CriteriaBuilder cb, Root<PedidoEntity> root, OrderSearchCriteria c) {
        List<Predicate> list = new ArrayList<>();
        if (c.customerId() != null) {
            list.add(cb.equal(root.get("customerId"), c.customerId()));
        }
        if (c.status() != null) {
            list.add(cb.equal(root.get("statusId"), statuses.idOf(c.status())));
        }
        if (c.kind() != null) {
            list.add(cb.equal(root.get("kind"), c.kind()));
        }
        if (c.from() != null) {
            list.add(cb.greaterThanOrEqualTo(root.<java.time.Instant>get("createdAt"), c.from()));
        }
        if (c.toExclusive() != null) {
            list.add(cb.lessThan(root.<java.time.Instant>get("createdAt"), c.toExclusive()));
        }
        if (c.q() != null && !c.q().isBlank()) {
            String needle = "%" + escapeLike(c.q().trim().toLowerCase(Locale.ROOT)) + "%";
            Predicate idMatch = cb.like(cb.lower(root.<String>get("code")), needle, '\\');
            if (c.qCustomerIds() != null && !c.qCustomerIds().isEmpty()) {
                list.add(cb.or(idMatch, root.get("customerId").in(c.qCustomerIds())));
            } else {
                list.add(idMatch);
            }
        }
        return list.toArray(Predicate[]::new);
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
