package com.armakers3d.incidents.infrastructure.inmemory;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link IncidentRepository}. NOT durable, in EVERY profile (no incidents table or migration yet,
 * PD-INC-06). Selected by {@code app.persistence.incidents=memory}; {@code InMemoryStorageGuard} refuses to
 * boot it under {@code prod}. Incidents are immutable records; codes come from an atomic counter.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.incidents", havingValue = "memory", matchIfMissing = true)
public class InMemoryIncidentRepository implements IncidentRepository {

    private final Map<String, Incident> byId = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public String nextIncidentNumber() {
        return String.format("INC-%06d", sequence.incrementAndGet());
    }

    @Override
    public Incident save(Incident incident) {
        byId.put(incident.id(), incident);
        return incident;
    }

    @Override
    public Optional<Incident> findById(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public List<Incident> findNonTerminalByOrderId(String orderId) {
        return byId.values().stream()
                .filter(i -> i.orderId().equals(orderId) && !i.status().isTerminal())
                .toList();
    }

    @Override
    public Page<Incident> search(IncidentSearchCriteria criteria, IncidentSort sort, PageRequest pageRequest) {
        List<Incident> matching = byId.values().stream()
                .filter(criteria::matches)
                .sorted(sort.comparator())
                .toList();
        return Page.of(matching, pageRequest);
    }

    @Override
    public boolean replaceIfCurrent(Incident expected, Incident updated) {
        boolean[] replaced = {false};
        byId.computeIfPresent(expected.id(), (id, current) -> {
            if (current.equals(expected)) {
                replaced[0] = true;
                return updated;
            }
            return current;
        });
        return replaced[0];
    }
}
