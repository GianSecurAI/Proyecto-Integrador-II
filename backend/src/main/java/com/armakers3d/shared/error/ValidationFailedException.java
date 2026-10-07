package com.armakers3d.shared.error;

import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Service-level validation failure (a rule a DTO annotation cannot express, e.g. a value that is
 * only invalid after trimming). Rendered exactly like a Bean Validation failure: 400
 * {@code VALIDATION_FAILED} with {@code fieldErrors}.
 */
public class ValidationFailedException extends ApiException implements HasFieldErrors {

    private final List<ApiError.FieldError> fieldErrors;

    public ValidationFailedException(String field, String message) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", field + ": " + message);
        this.fieldErrors = List.of(new ApiError.FieldError(field, message));
    }

    /** Several field failures at once (e.g. one per invalid order line). Must not be empty. */
    public ValidationFailedException(List<ApiError.FieldError> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                fieldErrors.get(0).field() + ": " + fieldErrors.get(0).message());
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    @Override
    public List<ApiError.FieldError> getFieldErrors() {
        return fieldErrors;
    }
}
