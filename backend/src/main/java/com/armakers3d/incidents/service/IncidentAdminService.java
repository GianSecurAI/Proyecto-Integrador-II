package com.armakers3d.incidents.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentRules;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.domain.InvalidIncidentTransitionException;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.orders.service.OrderLookupService;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import com.armakers3d.users.service.CustomerDirectoryService;
import com.armakers3d.users.service.CustomerDirectoryService.ContactView;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Staff side of incidents (contract E28-E31): list/filter, detail, triage (status and priority) and
 * resolution. Who may call it (ASESOR, ADMINISTRADOR) is decided by the central role matrix; the actor
 * always comes from the authenticated principal. THE only place an incident changes: the transition table
 * and the resolution rule live in the domain ({@link Incident#triage}, {@link Incident#resolve}); each write
 * is an atomic compare-and-set, so of two concurrent changes exactly one wins and the loser gets
 * 409 INVALID_STATUS_TRANSITION. Audit lines carry ids and enum values only (no description or resolution text).
 */
@Service
public class IncidentAdminService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.incidents");

    public record StaffFilter(String q, IncidentStatus status, IncidentPriority priority) {}

    /** An incident with the staff-only data around it: owner contact and the related order summary. */
    public record StaffIncidentView(Incident incident, ContactView customer, String orderSummary) {}

    /** The actor is taken from the principal by the controller, never from the body. */
    public record TriageCommand(
            String incidentId, IncidentStatus status, IncidentPriority priority, Long actorId, Rol actorRole) {}

    public record ResolveCommand(String incidentId, String resolutionText, Long actorId, Rol actorRole) {}

    private final IncidentRepository incidents;
    private final OrderLookupService orders;
    private final CustomerDirectoryService directory;
    private final Clock clock;

    public IncidentAdminService(
            IncidentRepository incidents, OrderLookupService orders, CustomerDirectoryService directory, Clock clock) {
        this.incidents = incidents;
        this.orders = orders;
        this.directory = directory;
        this.clock = clock;
    }

    public Page<StaffIncidentView> list(StaffFilter filter, String sort, PageRequest page) {
        String q = filter.q() == null || filter.q().isBlank() ? null : filter.q().trim();
        var criteria = new IncidentSearchCriteria(null, filter.status(), filter.priority(), q);
        Page<Incident> found = incidents.search(criteria, IncidentSort.parse(sort), page);
        Map<Long, ContactView> contacts =
                directory.contactsByIds(found.content().stream().map(Incident::customerId).toList());
        Map<String, String> summaries =
                orders.summariesByIds(found.content().stream().map(Incident::orderId).toList());
        return found.map(i -> new StaffIncidentView(i, contacts.get(i.customerId()), summaries.get(i.orderId())));
    }

    public StaffIncidentView get(String incidentId) {
        return view(find(incidentId));
    }

    public StaffIncidentView triage(TriageCommand cmd) {
        if (cmd.status() == null && cmd.priority() == null) {
            throw new ValidationFailedException("status", "status or priority is required");
        }
        if (cmd.status() == IncidentStatus.RESUELTA) {
            throw new ValidationFailedException(
                    "status", "RESUELTA is set only by registering a resolution (POST .../resolution)");
        }
        Incident current = find(cmd.incidentId());
        Incident updated;
        try {
            updated = current.triage(cmd.status(), cmd.priority(), clock.instant());
        } catch (InvalidIncidentTransitionException ex) {
            audit.warn("incident.status.rejected actor={} role={} incident={} from={} to={}",
                    cmd.actorId(), cmd.actorRole(), current.id(), current.status(), cmd.status());
            throw ex;
        }
        if (updated.equals(current)) {
            return view(current); // same priority and no status move: nothing to write or audit
        }
        store(current, updated, cmd.actorId(), cmd.actorRole());
        if (updated.status() != current.status()) {
            audit.info("incident.status.changed actor={} role={} incident={} from={} to={}",
                    cmd.actorId(), cmd.actorRole(), updated.id(), current.status(), updated.status());
        }
        if (updated.priority() != current.priority()) {
            audit.info("incident.priority.changed actor={} role={} incident={} from={} to={}",
                    cmd.actorId(), cmd.actorRole(), updated.id(), current.priority(), updated.priority());
        }
        return view(updated);
    }

    public StaffIncidentView resolve(ResolveCommand cmd) {
        String text = IncidentRules.validateResolution(cmd.resolutionText());
        Incident current = find(cmd.incidentId());
        Incident updated;
        try {
            updated = current.resolve(text, clock.instant());
        } catch (InvalidIncidentTransitionException ex) {
            audit.warn("incident.resolve.rejected actor={} role={} incident={} from={}",
                    cmd.actorId(), cmd.actorRole(), current.id(), current.status());
            throw ex;
        }
        store(current, updated, cmd.actorId(), cmd.actorRole());
        audit.info("incident.resolved actor={} role={} incident={} from={} to={}",
                cmd.actorId(), cmd.actorRole(), updated.id(), current.status(), updated.status());
        return view(updated);
    }

    private Incident find(String incidentId) {
        return incidents.findById(incidentId).orElseThrow(() -> new NotFoundException("Incident not found."));
    }

    private void store(Incident current, Incident updated, Long actorId, Rol actorRole) {
        if (!incidents.replaceIfCurrent(current, updated)) {
            audit.warn("incident.change.conflict actor={} role={} incident={}", actorId, actorRole, current.id());
            throw InvalidIncidentTransitionException.concurrentChange();
        }
    }

    private StaffIncidentView view(Incident incident) {
        ContactView contact = directory.contactsByIds(List.of(incident.customerId())).get(incident.customerId());
        return new StaffIncidentView(
                incident, contact, orders.summariesByIds(List.of(incident.orderId())).get(incident.orderId()));
    }
}
