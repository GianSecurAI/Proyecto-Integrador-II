package com.armakers3d.users.dto;

import com.armakers3d.users.domain.ProfileRules;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request of {@code PUT /api/customers/me}: a full replacement of the editable fields (omitted or
 * null clears the value). Email and role are not accepted here (unknown JSON fields are ignored).
 */
public record CustomerProfileUpdateRequestDto(
        @Size(max = ProfileRules.NAME_MAX, message = "firstName must be at most 80 characters") String firstName,
        @Size(max = ProfileRules.NAME_MAX, message = "lastName must be at most 80 characters") String lastName,
        @Pattern(
                        regexp = ProfileRules.PHONE_INPUT_REGEX,
                        message = "phone must be 6-20 characters: digits, +, -, spaces or parentheses")
                String phone) {}
