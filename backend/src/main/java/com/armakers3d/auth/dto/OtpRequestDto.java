package com.armakers3d.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request body for {@code POST /api/auth/otp/request} (contracts/otp-auth-api.md). */
public record OtpRequestDto(
        @NotBlank(message = "email is required")
                @Email(message = "email must be a syntactically valid address")
                @Size(max = 255, message = "email must be at most 255 characters")
                String email) {}
