package com.armakers3d.incidents.domain;

import java.time.Instant;

/**
 * Incident aggregate (contract review 4.7/4.9). Immutable; every change returns a new instance, so a
 * repository can use record equality as the compare-and-set expectation. {@code id} is the business code
 * {@code INC-######}. {@code customerId} is the owner of the related order, copied at creation.
 * {@code resolution} and {@code resolvedAt} are set together, only by {@link #resolve}. There is no
 * incident type (not approved) and no assignee (not specified).
 */
public record Incident(
        String id,
        String orderId,
        Long customerId,
        String description,
        IncidentStatus status,
        IncidentPriority priority,
        String resolution,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt) {

    public static final IncidentStatus INITIAL_STATUS = IncidentStatus.ABIERTA;
    public static final IncidentPriority DEFAULT_PRIORITY = IncidentPriority.MEDIA;

    /** A new incident: ABIERTA, MEDIA, no resolution. The description is already validated. */
    public static Incident open(String id, String orderId, Long customerId, String description, Instant now) {
        return new Incident(id, orderId, customerId, description, INITIAL_STATUS, DEFAULT_PRIORITY, null, now, now, null);
    }

    public boolean belongsTo(Long customerId) {
        return this.customerId.equals(customerId);
    }

    /**
     * Staff triage: an optional status move and/or an optional priority. The status must follow the table
     * and may not be RESUELTA (that needs a resolution text, see {@link #resolve}); anything else throws
     * {@link InvalidIncidentTransitionException}. Re-sending the current status is rejected, not a no-op.
     * Setting the priority it already has changes nothing. Returns {@code this} when nothing changes.
     */
    public Incident triage(IncidentStatus newStatus, IncidentPriority newPriority, Instant now) {
        if (newStatus != null && (newStatus == IncidentStatus.RESUELTA || !status.canTransitionTo(newStatus))) {
            throw new InvalidIncidentTransitionException(status, newStatus);
        }
        IncidentStatus nextStatus = newStatus == null ? status : newStatus;
        IncidentPriority nextPriority = newPriority == null ? priority : newPriority;
        if (nextStatus == status && nextPriority == priority) {
            return this;
        }
        return new Incident(id, orderId, customerId, description, nextStatus, nextPriority, resolution, createdAt, now,
                resolvedAt);
    }

    /** Registers the resolution and moves EN_REVISION to RESUELTA; from any other status (incl. already resolved) 409. */
    public Incident resolve(String resolutionText, Instant now) {
        if (!status.canTransitionTo(IncidentStatus.RESUELTA)) {
            throw new InvalidIncidentTransitionException(status, IncidentStatus.RESUELTA);
        }
        return new Incident(id, orderId, customerId, description, IncidentStatus.RESUELTA, priority, resolutionText,
                createdAt, now, now);
    }
}
