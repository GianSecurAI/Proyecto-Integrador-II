package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/**
 * The targeted code already reached its maximum verification-attempt count before this
 * submission (FR-011) — the code is now permanently unverifiable until a new one is requested.
 */
public class OtpAttemptLimitExceededException extends ApiException {

    public OtpAttemptLimitExceededException() {
        super(
                HttpStatus.TOO_MANY_REQUESTS,
                "OTP_ATTEMPTS_EXCEEDED",
                "Too many failed attempts. Please request a new code.");
    }
}
