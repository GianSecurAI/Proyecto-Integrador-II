package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/** The referenced resource does not exist. */
public class NotFoundException extends ApiException {

    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }
}
