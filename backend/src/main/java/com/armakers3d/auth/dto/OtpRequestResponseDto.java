package com.armakers3d.auth.dto;

/**
 * The always-identical acknowledgment for {@code POST /api/auth/otp/request}, whether or not the
 * email belongs to an existing account (FR-004 anti-enumeration guarantee).
 */
public record OtpRequestResponseDto(String message) {

    private static final String GENERIC_MESSAGE = "If this email is valid, a code has been sent.";

    public static OtpRequestResponseDto generic() {
        return new OtpRequestResponseDto(GENERIC_MESSAGE);
    }
}
