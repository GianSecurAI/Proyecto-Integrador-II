package com.armakers3d.shared.util;

import java.util.Locale;

/**
 * Single place for the two email rules every module shares: normalization (case-insensitive
 * matching is implemented by storing lower-case, see data-model.md) and masking for logs
 * (Principles XIII/XVIII: no full personal data in logs).
 */
public final class EmailAddress {

    private EmailAddress() {}

    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** {@code jane.doe@example.com} becomes {@code j***@example.com}; never throws. */
    public static String mask(String email) {
        if (email == null || email.isBlank()) {
            return "***";
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
