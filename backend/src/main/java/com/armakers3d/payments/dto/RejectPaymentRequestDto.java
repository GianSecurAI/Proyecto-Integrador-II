package com.armakers3d.payments.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/admin/payments/{checkoutId}/reject}: the reason is shown to the customer. */
public record RejectPaymentRequestDto(
        @NotBlank(message = "is required") @Size(max = 300, message = "must be at most 300 characters") String reason) {}
