package com.armakers3d.orders.service.exception;

import com.armakers3d.shared.error.ConflictException;

/** The same Idempotency-Key was sent with a different request body (409 IDEMPOTENCY_KEY_REUSED). */
public class IdempotencyKeyReusedException extends ConflictException {

    public IdempotencyKeyReusedException() {
        super("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.");
    }
}
