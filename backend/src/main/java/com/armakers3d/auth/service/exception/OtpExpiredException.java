package com.armakers3d.auth.service.exception;

import com.armakers3d.shared.error.ApiException;
import org.springframework.http.HttpStatus;

/** The matching code's expiration time has already passed (FR-008). */
public class OtpExpiredException extends ApiException {

    public OtpExpiredException() {
        super(HttpStatus.GONE, "OTP_EXPIRED", "This code has expired. Please request a new one.");
    }
}
