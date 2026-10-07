package com.armakers3d.payments.service;

import java.util.Optional;
import java.util.UUID;

/** Checkout ids are random UUIDs; anything else cannot be ours and is treated like an unknown id (same 404). */
final class CheckoutIds {

    private CheckoutIds() {}

    static Optional<String> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(raw).toString());
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
