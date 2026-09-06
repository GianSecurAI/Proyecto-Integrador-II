package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/** No valid, non-expired, non-revoked session was found for the request (FR-016; contract 401). */
public class UnauthenticatedException extends ApiException {

    public UnauthenticatedException() {
        super(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required to access this resource.");
    }
}
