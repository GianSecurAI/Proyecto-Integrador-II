package com.armakers3d.auth.dto;

/**
 * Response for a successful {@code POST /api/auth/otp/verify} (contracts/otp-auth-api.md).
 * {@code accountStatus} is the only point at which account existence may ever be revealed
 * (FR-004a), since reaching this point already proves mailbox possession. Never contains the
 * code or its hash (FR-002) — enforced by construction, since this type has no such field.
 */
public record OtpVerifyResponseDto(String accountStatus) {

    public static final String CREATED = "created";
    public static final String EXISTING = "existing";
}
