package com.armakers3d.users.dto;

import com.armakers3d.auth.domain.Rol;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request of {@code POST /api/admin/users}: provisions an ASESOR or ADMINISTRADOR account (CLIENTE is rejected by the service). */
public record AdminUserCreateRequestDto(
        @NotBlank(message = "email is required")
                @Email(message = "email must be a syntactically valid address")
                @Size(max = 255, message = "email must be at most 255 characters")
                String email,
        @NotNull(message = "role is required") Rol role) {}
