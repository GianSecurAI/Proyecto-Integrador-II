package com.armakers3d.quotations.infrastructure.jpa;

import com.armakers3d.quotations.domain.Quotation;
import com.armakers3d.quotations.domain.QuotationSearchCriteria;
import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.quotations.repository.QuotationRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.shared.persistence.CotizacionEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL-backed {@link QuotationRepository} over {@code cotizacion} (+ {@code detalle_cotizacion}). Selected by
 * {@code app.persistence.quotations=jpa}. The status compare-and-set locks the quotation row.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.quotations", havingValue = "jpa")
public class JpaQuotationRepositoryAdapter implements QuotationRepository {

    private final QuotationJpaRepository jpa;

    @PersistenceContext
    private EntityManager em;

    public JpaQuotationRepositoryAdapter(QuotationJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    @Transactional
    public Quotation save(Quotation q) {
        if (q.id() == null) {
            CotizacionEntity created = new CotizacionEntity(
                    q.customerId(), q.description(), q.agreedAmount(), q.status().name(), q.quotedAt(), q.notes(),
                    q.registeredBy());
            return toDomain(jpa.saveAndFlush(created));
        }
        CotizacionEntity entity = jpa.findById(q.id())
                .orElseThrow(() -> new IllegalStateException("Unknown quotation " + q.id()));
        entity.changeStatus(q.status().name(), q.notes(), q.updatedAt());
        return toDomain(jpa.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Quotation> findById(Long id) {
        return jpa.findById(id).map(JpaQuotationRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Quotation> search(QuotationSearchCriteria criteria, PageRequest pageRequest) {
        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<CotizacionEntity> countRoot = count.from(CotizacionEntity.class);
        count.select(cb.count(countRoot)).where(predicates(cb, countRoot, criteria));
        long total = em.createQuery(count).getSingleResult();

        CriteriaQuery<CotizacionEntity> query = cb.createQuery(CotizacionEntity.class);
        Root<CotizacionEntity> root = query.from(CotizacionEntity.class);
        query.select(root)
                .where(predicates(cb, root, criteria))
                .orderBy(cb.desc(root.get("quotedAt")), cb.desc(root.get("id")));
        List<Quotation> content = em.createQuery(query)
                .setFirstResult((int) pageRequest.offset())
                .setMaxResults(pageRequest.size())
                .getResultList()
                .stream()
                .map(JpaQuotationRepositoryAdapter::toDomain)
                .toList();

        int totalPages = (int) ((total + pageRequest.size() - 1L) / pageRequest.size());
        return new Page<>(content, pageRequest.page(), pageRequest.size(), total, totalPages);
    }

    @Override
    @Transactional
    public boolean replaceIfStatus(Quotation updated, QuotationStatus expected) {
        Optional<CotizacionEntity> locked = jpa.findByIdForUpdate(updated.id());
        if (locked.isEmpty() || !locked.get().getStatus().equals(expected.name())) {
            return false;
        }
        locked.get().changeStatus(updated.status().name(), updated.notes(), updated.updatedAt());
        jpa.save(locked.get());
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Aggregate aggregate(Instant from, Instant toExclusive) {
        Map<QuotationStatus, Long> counts = new EnumMap<>(QuotationStatus.class);
        Map<QuotationStatus, BigDecimal> amounts = new EnumMap<>(QuotationStatus.class);
        for (QuotationStatus s : QuotationStatus.values()) {
            counts.put(s, 0L);
            amounts.put(s, BigDecimal.ZERO.setScale(2));
        }
        for (QuotationJpaRepository.StatusTotals t : jpa.totalsByStatus(from, toExclusive)) {
            QuotationStatus status = QuotationStatus.valueOf(t.getStatus());
            counts.put(status, t.getTotal());
            amounts.put(status, t.getAmount().setScale(2));
        }
        return new Aggregate(counts, amounts);
    }

    private static Predicate[] predicates(CriteriaBuilder cb, Root<CotizacionEntity> root, QuotationSearchCriteria c) {
        List<Predicate> list = new ArrayList<>();
        if (c.status() != null) {
            list.add(cb.equal(root.get("status"), c.status().name()));
        }
        if (c.from() != null) {
            list.add(cb.greaterThanOrEqualTo(root.<Instant>get("quotedAt"), c.from()));
        }
        if (c.toExclusive() != null) {
            list.add(cb.lessThan(root.<Instant>get("quotedAt"), c.toExclusive()));
        }
        if (c.q() != null && !c.q().isBlank()) {
            String needle = "%" + escapeLike(c.q().trim().toLowerCase(Locale.ROOT)) + "%";
            Predicate text = cb.like(cb.lower(root.<String>get("description")), needle, '\\');
            if (c.qCustomerIds() != null && !c.qCustomerIds().isEmpty()) {
                list.add(cb.or(text, root.get("customerId").in(c.qCustomerIds())));
            } else {
                list.add(text);
            }
        }
        return list.toArray(Predicate[]::new);
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static Quotation toDomain(CotizacionEntity e) {
        return new Quotation(
                e.getId(),
                e.getCustomerId(),
                e.getDescription(),
                e.getAgreedAmount(),
                QuotationStatus.valueOf(e.getStatus()),
                e.getQuotedAt(),
                e.getUpdatedAt(),
                e.getNotes(),
                e.getRegisteredBy());
    }
}
