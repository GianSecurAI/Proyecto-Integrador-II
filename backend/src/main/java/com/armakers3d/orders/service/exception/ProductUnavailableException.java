package com.armakers3d.orders.service.exception;

import com.armakers3d.shared.error.ApiError;
import com.armakers3d.shared.error.ApiException;
import com.armakers3d.shared.error.HasFieldErrors;
import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * One or more requested products do not exist or are not available (business rule 9; contract review
 * 409 PRODUCT_UNAVAILABLE). Unknown and unavailable are deliberately indistinguishable. Carries one
 * field error per offending line so the SPA can show "cart adjusted".
 */
public class ProductUnavailableException extends ApiException implements HasFieldErrors {

    private final List<ApiError.FieldError> fieldErrors;

    public ProductUnavailableException(List<ApiError.FieldError> fieldErrors) {
        super(HttpStatus.CONFLICT, "PRODUCT_UNAVAILABLE", "One or more products are not available.");
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    @Override
    public List<ApiError.FieldError> getFieldErrors() {
        return fieldErrors;
    }
}
