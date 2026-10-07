package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** The operation is not allowed in the checkout's current state (409 CHECKOUT_STATE_CONFLICT). The message never names internals. */
public class CheckoutStateException extends ConflictException {

    public CheckoutStateException(String message) {
        super("CHECKOUT_STATE_CONFLICT", message);
    }
}
