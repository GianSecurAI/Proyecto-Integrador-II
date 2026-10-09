package com.armakers3d.orders.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** 409: the quotation already generated its order (a quotation produces at most one order, RN08). */
public class QuotationAlreadyOrderedException extends ConflictException {

    public QuotationAlreadyOrderedException() {
        super("QUOTATION_ALREADY_ORDERED", "This quotation already generated its order.");
    }
}
