package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/**
 * A valid session exists, but the requested role or object-level scope is not permitted
 * (FR-016; contract 403) — e.g. a Cliente session reading another customer's data, or reaching
 * an ADMINISTRADOR-only endpoint.
 */
public class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}
