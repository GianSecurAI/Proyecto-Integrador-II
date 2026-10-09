package com.armakers3d.quotations.infrastructure.inmemory;

import com.armakers3d.quotations.domain.Quotation;
import com.armakers3d.quotations.domain.QuotationSearchCriteria;
import com.armakers3d.quotations.domain.QuotationStatus;
import com.armakers3d.quotations.repository.QuotationRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link QuotationRepository}. NOT durable; selected by {@code app.persistence.quotations=memory}, which is
 * only allowed in the nodb profile and in tests.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.quotations", havingValue = "memory", matchIfMissing = true)
public class InMemoryQuotationRepository implements QuotationRepository {

    private final Map<Long, Quotation> byId = new HashMap<>();
    private long sequence;

    @Override
    public synchronized Quotation save(Quotation quotation) {
        Quotation toStore = quotation.id() == null ? quotation.withId(++sequence) : quotation;
        byId.put(toStore.id(), toStore);
        return toStore;
    }

    @Override
    public synchronized Optional<Quotation> findById(Long id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public synchronized Page<Quotation> search(QuotationSearchCriteria criteria, PageRequest pageRequest) {
        List<Quotation> matching = byId.values().stream()
                .filter(criteria::matches)
                .sorted(Comparator.comparing(Quotation::quotedAt).thenComparing(Quotation::id).reversed())
                .toList();
        return Page.of(matching, pageRequest);
    }

    @Override
    public synchronized boolean replaceIfStatus(Quotation updated, QuotationStatus expected) {
        Quotation current = byId.get(updated.id());
        if (current == null || current.status() != expected) {
            return false;
        }
        byId.put(updated.id(), updated);
        return true;
    }

    @Override
    public synchronized Aggregate aggregate(Instant from, Instant toExclusive) {
        Map<QuotationStatus, Long> counts = new EnumMap<>(QuotationStatus.class);
        Map<QuotationStatus, BigDecimal> amounts = new EnumMap<>(QuotationStatus.class);
        for (QuotationStatus s : QuotationStatus.values()) {
            counts.put(s, 0L);
            amounts.put(s, BigDecimal.ZERO.setScale(2));
        }
        for (Quotation q : byId.values()) {
            if (q.quotedAt().isBefore(from) || !q.quotedAt().isBefore(toExclusive)) {
                continue;
            }
            counts.merge(q.status(), 1L, Long::sum);
            amounts.merge(q.status(), q.agreedAmount(), BigDecimal::add);
        }
        return new Aggregate(counts, amounts);
    }
}
