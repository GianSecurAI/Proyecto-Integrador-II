package com.armakers3d.users.dto;

import jakarta.validation.constraints.NotNull;

/** Request of {@code PATCH /api/admin/users/{id}/active}. */
public record ActiveChangeRequestDto(@NotNull(message = "active is required") Boolean active) {}
