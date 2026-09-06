package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The submitted code does not match the newest issued code for the email (FR-007). */
public class InvalidOtpCodeException extends ApiException {

    public InvalidOtpCodeException() {
        super(HttpStatus.UNAUTHORIZED, "OTP_INVALID", "The submitted code is not valid.");
    }
}
