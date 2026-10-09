package com.armakers3d.quotations.domain;

import com.armakers3d.orders.domain.PersonalizedOrderRules;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;

/** Input rules of a quotation: the same email, description and amount rules as a personalized order, plus notes. */
public final class QuotationRules {

    public static final int NOTES_MAX = 500;

    public record Validated(String customerEmail, String description, BigDecimal agreedAmount, String notes) {}

    private QuotationRules() {}

    public static Validated validate(String customerEmail, String description, BigDecimal agreedAmount, String notes) {
        // the payment flag belongs to the order, not to the quotation: pass TRUE so only the shared fields are checked
        var base = PersonalizedOrderRules.validate(customerEmail, description, agreedAmount, Boolean.TRUE);
        return new Validated(base.customerEmail(), base.description(), base.agreedAmount(), notes(notes));
    }

    /** Trims; blank becomes null; rejects over-long text and control characters. */
    public static String notes(String notes) {
        if (notes == null) {
            return null;
        }
        String trimmed = notes.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > NOTES_MAX) {
            throw new ValidationFailedException("notes", "must be at most " + NOTES_MAX + " characters");
        }
        if (trimmed.chars().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) {
            throw new ValidationFailedException("notes", "must not contain control characters");
        }
        return trimmed;
    }
}
