package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/**
 * The email has already reached its OTP-request limit within the throttling window (FR-012).
 * Message text is deliberately identical to what a normal successful request would not use, but
 * MUST NOT reveal whether the email is registered (FR-004 applies to throttled requests too —
 * spec.md's Edge Cases and contract explicitly call this out).
 */
public class OtpRequestThrottledException extends ApiException {

    public OtpRequestThrottledException() {
        super(
                HttpStatus.TOO_MANY_REQUESTS,
                "OTP_REQUEST_THROTTLED",
                "Too many requests. Please try again later.");
    }
}
