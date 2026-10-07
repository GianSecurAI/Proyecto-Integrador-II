package com.armakers3d.orders.repository;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;

/**
 * Port that makes order submission idempotent per customer. One atomic operation so two concurrent
 * submissions with the same (customer, key) can never both create an order: the first runs
 * {@code create}, the others wait and get its result (REPLAYED) or MISMATCH when the content differs.
 *
 * <p>Contract: an entry lives {@code ttl} after creation, then the key is free again. If
 * {@code create} throws, nothing is remembered and the exception propagates. A JPA adapter would use
 * a unique (customer_id, key) constraint with a row lock instead of an in-process lock.
 */
public interface IdempotencyStore {

    enum Outcome {
        /** This call ran {@code create}. */
        CREATED,
        /** A live entry with the same fingerprint existed; its order id is returned. */
        REPLAYED,
        /** A live entry with a DIFFERENT fingerprint existed; nothing was created. */
        MISMATCH
    }

    record Result(Outcome outcome, String orderId) {}

    Result executeOnce(
            Long customerId, String key, String fingerprint, Instant now, Duration ttl, Supplier<String> create);
}
