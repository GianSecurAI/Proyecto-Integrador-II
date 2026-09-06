package com.armakers3d.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for {@code POST /api/auth/otp/verify} (contracts/otp-auth-api.md).
 *
 * <p>{@code code} is deliberately validated only for presence, not for exact format (e.g. no
 * {@code @Pattern(digits, length 6)}). spec.md's Edge Cases require a malformed code (wrong
 * length, non-numeric) to be rejected through the *same* path as any other incorrect code and to
 * still count toward the attempt limit — a DTO-level 400 for a bad format would bypass
 * {@code OtpService}'s attempt-counting entirely, opening a throttle-bypass loophole. A malformed
 * value simply never matches the stored hash in the service layer, achieving the same rejection
 * outcome the constitution requires without a second, duplicated validation path (Prohibited
 * Practices #3).
 */
public record OtpVerifyDto(
        @NotBlank(message = "email is required")
                @Email(message = "email must be a syntactically valid address")
                @Size(max = 255, message = "email must be at most 255 characters")
                String email,
        @NotBlank(message = "code is required") @Size(max = 32, message = "code is too long") String code) {}
