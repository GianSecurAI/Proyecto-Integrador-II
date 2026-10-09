package com.armakers3d.quotations.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A price agreed between the customer and Ar Makers 3D over WhatsApp for a personalized product (RN06, RN07). The
 * system never computes it: {@code agreedAmount} is typed by staff. {@code id} is null until stored.
 */
public record Quotation(
        Long id,
        Long customerId,
        String description,
        BigDecimal agreedAmount,
        QuotationStatus status,
        Instant quotedAt,
        Instant updatedAt,
        String notes,
        Long registeredBy) {

    public static Quotation register(
            Long customerId, String description, BigDecimal agreedAmount, String notes, Long registeredBy, Instant now) {
        return new Quotation(
                null, customerId, description, agreedAmount, QuotationStatus.REGISTRADA, now, now, notes, registeredBy);
    }

    /** The same quotation in a new status; throws when the transition is not allowed from the current one. */
    public Quotation withStatus(QuotationStatus newStatus, String newNotes, Instant now) {
        if (!status.canTransitionTo(newStatus)) {
            throw new InvalidQuotationTransitionException(status, newStatus);
        }
        return new Quotation(
                id, customerId, description, agreedAmount, newStatus, quotedAt, now,
                newNotes == null ? notes : newNotes, registeredBy);
    }

    public Quotation withId(Long newId) {
        return new Quotation(
                newId, customerId, description, agreedAmount, status, quotedAt, updatedAt, notes, registeredBy);
    }
}
