package com.armakers3d.orders.domain;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

/**
 * Persistence-neutral filter; every field optional (null = no filter). {@code from} is inclusive and
 * {@code toExclusive} exclusive (the service converts the contract's inclusive Lima dates). {@code q} is a
 * case-insensitive substring of the order id; {@code qCustomerIds} are the owners already resolved by the
 * service from the same text (customer email), so a row matches the text when EITHER matches.
 * {@link #matches} is the reference semantics every adapter must reproduce.
 */
public record OrderSearchCriteria(
        Long customerId,
        OrderStatus status,
        OrderKind kind,
        Instant from,
        Instant toExclusive,
        String q,
        Set<Long> qCustomerIds) {

    public boolean matches(Order o) {
        if (customerId != null && !customerId.equals(o.customerId())) {
            return false;
        }
        if (status != null && o.status() != status) {
            return false;
        }
        if (kind != null && o.kind() != kind) {
            return false;
        }
        if (from != null && o.createdAt().isBefore(from)) {
            return false;
        }
        if (toExclusive != null && !o.createdAt().isBefore(toExclusive)) {
            return false;
        }
        if (q != null && !q.isBlank()) {
            boolean idMatch = o.id().toLowerCase(Locale.ROOT).contains(q.trim().toLowerCase(Locale.ROOT));
            boolean ownerMatch = qCustomerIds != null && qCustomerIds.contains(o.customerId());
            return idMatch || ownerMatch;
        }
        return true;
    }
}
