package com.armakers3d.shared.error;

import java.time.Instant;

/**
 * The single JSON error envelope every non-2xx response uses (Constitution Principle IX). Never
 * carries a stack trace or other internal implementation detail.
 */
public record ApiError(String code, String message, Instant timestamp) {

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, Instant.now());
    }
}
