package com.armakers3d.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request body for {@code POST /api/auth/otp/request} (contracts/otp-auth-api.md and contract
 * review E1). The optional profile fields are validated server-side but are NOT persisted yet:
 * there is no storage for them without a schema migration (see backend-foundation.md, auth
 * delta notes). They are never echoed back, so they cannot become an existence signal.
 */
public record OtpRequestDto(
        @NotBlank(message = "email is required")
                @Email(message = "email must be a syntactically valid address")
                @Size(max = 255, message = "email must be at most 255 characters")
                String email,
        @Size(max = 80, message = "firstName must be at most 80 characters") String firstName,
        @Size(max = 80, message = "lastName must be at most 80 characters") String lastName,
        @Pattern(
                        regexp = "^[0-9+\\-\\s()]{6,20}$",
                        message = "phone must be 6-20 characters: digits, +, -, spaces or parentheses")
                String phone) {}
