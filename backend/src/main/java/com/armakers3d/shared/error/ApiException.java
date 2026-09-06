package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/**
 * Base type for every domain-specific rejection reason (Constitution Principle IX: one
 * centralized exception-handling mechanism). Each subclass is a distinct, named rejection
 * reason (Principle XII test traceability), but all of them are handled generically by
 * {@link GlobalExceptionHandler} through this common contract, so no controller ever needs its
 * own try/catch.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    protected ApiException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
