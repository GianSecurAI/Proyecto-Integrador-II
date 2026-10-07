package com.armakers3d.auth.dto;

import com.armakers3d.auth.domain.Rol;

/**
 * Response for a successful {@code POST /api/auth/otp/verify} (contracts/otp-auth-api.md).
 * {@code accountStatus} is the only point at which account existence may ever be revealed
 * (FR-004a), since reaching this point already proves mailbox possession. Never contains the
 * code or its hash (FR-002) — enforced by construction, since this type has no such field. {@code role} is the
 * session role so the SPA can route immediately; {@code GET /api/auth/me} remains the source
 * used to restore a session after a reload.
 */
public record OtpVerifyResponseDto(String accountStatus, Rol role) {

    public static final String CREATED = "created";
    public static final String EXISTING = "existing";
}
