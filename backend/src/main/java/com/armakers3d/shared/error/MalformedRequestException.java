package com.armakers3d.shared.error;

import org.springframework.http.HttpStatus;

/** A syntactically valid request that uses an unsupported value, e.g. a non-whitelisted sort field. */
public class MalformedRequestException extends ApiException {

    public MalformedRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", message);
    }
}
