package com.armakers3d.shared.error;

import java.util.List;

/**
 * Implemented by an {@link ApiException} that carries per-field details, so
 * {@link GlobalExceptionHandler} renders them in {@code ApiError.fieldErrors} without knowing the
 * concrete feature exception (shared must not depend on any feature).
 */
public interface HasFieldErrors {

    List<ApiError.FieldError> getFieldErrors();
}
