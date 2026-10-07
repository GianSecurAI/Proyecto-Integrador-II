package com.armakers3d.incidents.domain;

import java.time.Instant;
import java.util.Locale;

/**
 * Persistence-neutral filter; every field optional (null = no filter). {@code q} is a case-insensitive
 * substring of the description. {@code from} is inclusive and {@code toExclusive} exclusive, both on {@code createdAt}
 * (the reports module converts the inclusive Lima dates). {@link #matches} is the reference semantics every adapter must reproduce.
 */
public record IncidentSearchCriteria(
        Long customerId,
        IncidentStatus status,
        IncidentPriority priority,
        String q,
        Instant from,
        Instant toExclusive) {

    /** No date window (the original four filters). */
    public IncidentSearchCriteria(Long customerId, IncidentStatus status, IncidentPriority priority, String q) {
        this(customerId, status, priority, q, null, null);
    }

    public boolean matches(Incident i) {
        if (customerId != null && !customerId.equals(i.customerId())) {
            return false;
        }
        if (status != null && i.status() != status) {
            return false;
        }
        if (priority != null && i.priority() != priority) {
            return false;
        }
        if (from != null && i.createdAt().isBefore(from)) {
            return false;
        }
        if (toExclusive != null && !i.createdAt().isBefore(toExclusive)) {
            return false;
        }
        if (q != null && !q.isBlank()) {
            return i.description().toLowerCase(Locale.ROOT).contains(q.trim().toLowerCase(Locale.ROOT));
        }
        return true;
    }
}
