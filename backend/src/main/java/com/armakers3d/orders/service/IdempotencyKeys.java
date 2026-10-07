package com.armakers3d.orders.service;

import com.armakers3d.shared.error.ValidationFailedException;
import java.util.Locale;
import java.util.regex.Pattern;

/** Shared parsing of the optional {@code Idempotency-Key} header (standard and personalized order creation). */
public final class IdempotencyKeys {

    private static final Pattern UUID_FORMAT =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private IdempotencyKeys() {}

    /** Null when absent; otherwise a lower-cased UUID. A present but malformed key is rejected, not ignored. */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (!UUID_FORMAT.matcher(trimmed).matches()) {
            throw new ValidationFailedException("Idempotency-Key", "must be a UUID");
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
