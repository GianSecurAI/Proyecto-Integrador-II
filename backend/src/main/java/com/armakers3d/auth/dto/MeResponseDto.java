package com.armakers3d.auth.dto;

import com.armakers3d.auth.domain.Rol;

/**
 * Response of {@code GET /api/auth/me} (contract review E3): the authenticated account as the SPA
 * needs it to restore a session and route by role. Profile fields (names, phone) belong to the
 * separate customer-profile endpoint and are deliberately absent here.
 */
public record MeResponseDto(Long id, String email, Rol role) {}
