package com.armakers3d.users.dto;

import com.armakers3d.auth.domain.Rol;
import jakarta.validation.constraints.NotNull;

/** Request of {@code PATCH /api/admin/users/{id}/role}. */
public record RoleChangeRequestDto(@NotNull(message = "role is required") Rol role) {}
