package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The uploaded file is empty, truncated, corrupt, has zero or absurd dimensions or carries trailing/embedded data (400 INVALID_PROOF_IMAGE). */
public class InvalidProofImageException extends ApiException {

    public InvalidProofImageException(String message) {
        super(HttpStatus.BAD_REQUEST, "INVALID_PROOF_IMAGE", message);
    }
}
