package com.armakers3d.payments.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** An uploaded proof above the configured limit (413 PAYLOAD_TOO_LARGE). */
public class PayloadTooLargeException extends ApiException {

    public PayloadTooLargeException() {
        super(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "The uploaded file is too large (maximum 5 MB).");
    }
}
