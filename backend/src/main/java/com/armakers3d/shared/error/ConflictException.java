package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/** A request that conflicts with the current state of a resource (409). Subclasses give a specific code. */
public class ConflictException extends ApiException {

    public ConflictException(String message) {
        this("CONFLICT", message);
    }

    protected ConflictException(String errorCode, String message) {
        super(HttpStatus.CONFLICT, errorCode, message);
    }
}
