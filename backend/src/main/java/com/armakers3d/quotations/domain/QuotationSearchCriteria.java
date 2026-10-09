package com.armakers3d.quotations.domain;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

/** Filters of the staff quotation list; every field is optional. */
public record QuotationSearchCriteria(
        QuotationStatus status, Instant from, Instant toExclusive, String q, Set<Long> qCustomerIds) {

    public boolean matches(Quotation quotation) {
        if (status != null && quotation.status() != status) {
            return false;
        }
        if (from != null && quotation.quotedAt().isBefore(from)) {
            return false;
        }
        if (toExclusive != null && !quotation.quotedAt().isBefore(toExclusive)) {
            return false;
        }
        if (q != null && !q.isBlank()) {
            boolean text = quotation.description().toLowerCase(Locale.ROOT).contains(q.trim().toLowerCase(Locale.ROOT));
            boolean owner = qCustomerIds != null && qCustomerIds.contains(quotation.customerId());
            return text || owner;
        }
        return true;
    }
}
