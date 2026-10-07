package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.PersonalizedOrderRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Request of {@code POST /api/admin/orders/personalized} (contract review E27). Only these four fields are
 * read: there is no field for status, kind, id, registeredBy, role or customer id; unknown JSON properties
 * are ignored (project convention) so a forged value has no effect. {@link PersonalizedOrderRules}
 * re-validates everything (format, range, scale, payment-number heuristics).
 */
public record RegisterPersonalizedOrderRequestDto(
        @NotBlank @Size(max = PersonalizedOrderRules.EMAIL_MAX, message = "must be at most 255 characters")
                String customerEmail,
        @NotBlank @Size(max = PersonalizedOrderRules.DESCRIPTION_MAX, message = "must be at most 1000 characters")
                String description,
        @NotNull BigDecimal agreedAmount,
        @NotNull Boolean paymentConfirmed) {}
