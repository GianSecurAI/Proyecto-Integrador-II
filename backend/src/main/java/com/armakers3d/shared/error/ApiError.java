package com.armakers3d.shared.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * The single JSON error envelope every non-2xx response uses (Constitution Principle IX). Never
 * carries a stack trace or other internal implementation detail. {@code fieldErrors} is only
 * present for validation failures.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(String code, String message, Instant timestamp, List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {}

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, Instant.now(), null);
    }

    public static ApiError of(String code, String message, List<FieldError> fieldErrors) {
        return new ApiError(code, message, Instant.now(), fieldErrors);
    }
}
