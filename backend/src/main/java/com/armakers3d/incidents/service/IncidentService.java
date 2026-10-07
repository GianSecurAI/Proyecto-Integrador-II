package com.armakers3d.incidents.service;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentRules;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.orders.service.OrderLookupService;
import com.armakers3d.orders.service.OrderLookupService.OrderBrief;
import com.armakers3d.shared.error.ConflictException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Customer side of incidents (contract E22, E23 and the own-detail read). Object-level rule (Principle VII,
 * review finding 51): a customer registers an incident only for an order they own, and reads only incidents
 * whose owner is the authenticated account; an unknown order, a not-owned order, an unknown incident and a
 * not-owned incident each produce the SAME {@code 404 NOT_FOUND}, so existence cannot be probed. The owner is
 * always the principal; the customer never supplies status, priority or resolution (the DTO has no such
 * fields). No email is sent: incident notifications are not specified. {@code @Transactional} arrives with
 * the JPA adapter.
 */
@Service
public class IncidentService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.incidents");

    /** An incident with the order summary the SPA shows next to it. */
    public record CustomerIncidentView(Incident incident, String orderSummary) {}

    private final IncidentRepository incidents;
    private final OrderLookupService orders;
    private final Clock clock;
    /** Serializes check-then-save so the cap and the duplicate guard cannot be raced (in-memory, single instance). */
    private final Object createLock = new Object();

    public IncidentService(IncidentRepository incidents, OrderLookupService orders, Clock clock) {
        this.incidents = incidents;
        this.orders = orders;
        this.clock = clock;
    }

    public CustomerIncidentView register(Long customerId, String orderId, String description) {
        var valid = IncidentRules.validateNew(orderId, description);
        // 404 for unknown AND not-owned orders (same as the order endpoints).
        OrderBrief order = orders.requireOwned(customerId, valid.orderId());
        Incident created;
        synchronized (createLock) {
            List<Incident> open = incidents.findNonTerminalByOrderId(order.id());
            if (open.stream().anyMatch(i -> i.description().equals(valid.description()))) {
                audit.warn("incident.create.duplicate actor={} order={}", customerId, order.id());
                throw new ConflictException("An open incident with the same description already exists for this order.");
            }
            if (open.size() >= IncidentRules.MAX_OPEN_PER_ORDER) {
                audit.warn("incident.create.limit actor={} order={}", customerId, order.id());
                throw new ConflictException("This order already has the maximum number of open incidents ("
                        + IncidentRules.MAX_OPEN_PER_ORDER + ").");
            }
            created = incidents.save(Incident.open(
                    incidents.nextIncidentNumber(), order.id(), customerId, valid.description(), clock.instant()));
        }
        // Ids only: the description is never logged.
        audit.info("incident.created actor={} incident={} order={} status={} priority={}",
                customerId, created.id(), created.orderId(), created.status(), created.priority());
        return new CustomerIncidentView(created, order.summary());
    }

    public Page<CustomerIncidentView> listForCustomer(
            Long customerId, IncidentStatus status, String sort, PageRequest page) {
        var criteria = new IncidentSearchCriteria(customerId, status, null, null);
        Page<Incident> found = incidents.search(criteria, IncidentSort.parse(sort), page);
        Map<String, String> summaries =
                orders.summariesByIds(found.content().stream().map(Incident::orderId).toList());
        return found.map(i -> new CustomerIncidentView(i, summaries.get(i.orderId())));
    }

    /** Unknown id and not-owned id are indistinguishable by design. */
    public CustomerIncidentView getForCustomer(Long customerId, String incidentId) {
        Incident incident = incidents.findById(incidentId)
                .filter(i -> i.belongsTo(customerId))
                .orElseThrow(() -> new NotFoundException("Incident not found."));
        return new CustomerIncidentView(
                incident, orders.summariesByIds(List.of(incident.orderId())).get(incident.orderId()));
    }
}
