package com.armakers3d.quotations.domain;

import com.armakers3d.shared.error.ConflictException;

/** 409: the requested quotation status change is not allowed from the current status (or lost a race). */
public class InvalidQuotationTransitionException extends ConflictException {

    public InvalidQuotationTransitionException(QuotationStatus from, QuotationStatus to) {
        super("INVALID_QUOTATION_TRANSITION", "Cannot change the quotation status from " + from + " to " + to + ".");
    }

    private InvalidQuotationTransitionException(String message) {
        super("INVALID_QUOTATION_TRANSITION", message);
    }

    public static InvalidQuotationTransitionException concurrentChange() {
        return new InvalidQuotationTransitionException(
                "The quotation was changed by another request; reload it and try again.");
    }
}
