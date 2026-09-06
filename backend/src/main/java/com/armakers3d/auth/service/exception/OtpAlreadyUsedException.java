package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The matching code was already successfully used once before (FR-009). */
public class OtpAlreadyUsedException extends ApiException {

    public OtpAlreadyUsedException() {
        super(HttpStatus.GONE, "OTP_ALREADY_USED", "This code has already been used.");
    }
}
