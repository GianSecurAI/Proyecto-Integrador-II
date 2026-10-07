package com.armakers3d.incidents.repository;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.List;
import java.util.Optional;

/**
 * Port for incident persistence. Behavior every adapter must have: {@link #nextIncidentNumber()} returns a
 * unique business code {@code INC-######}, never reused; {@code save} stores the incident under
 * {@code incident.id()}; {@code findById} is empty for unknown ids; {@code findNonTerminalByOrderId} returns
 * only ABIERTA / EN_REVISION incidents of that order; {@code search} applies
 * {@link IncidentSearchCriteria#matches}, orders by {@link IncidentSort#comparator()} and pages;
 * {@code replaceIfCurrent} is an atomic compare-and-set on the whole stored value. Ownership checks belong
 * to the service.
 */
public interface IncidentRepository {

    String nextIncidentNumber();

    Incident save(Incident incident);

    Optional<Incident> findById(String id);

    List<Incident> findNonTerminalByOrderId(String orderId);

    Page<Incident> search(IncidentSearchCriteria criteria, IncidentSort sort, PageRequest pageRequest);

    /**
     * Replaces the stored incident with {@code updated} only if it exists and currently equals
     * {@code expected}. Returns false (and changes nothing) otherwise. Atomic: of N concurrent calls with the
     * same expectation exactly one returns true.
     */
    boolean replaceIfCurrent(Incident expected, Incident updated);
}
