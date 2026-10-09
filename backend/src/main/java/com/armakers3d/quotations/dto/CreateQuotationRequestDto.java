package com.armakers3d.quotations.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Body of {@code POST /api/admin/quotations}: the price agreed over WhatsApp, typed by staff. */
public record CreateQuotationRequestDto(
        @NotBlank @Size(max = 255, message = "must be at most 255 characters") String customerEmail,
        @NotBlank @Size(max = 1000, message = "must be at most 1000 characters") String description,
        @NotNull BigDecimal agreedAmount,
        @Size(max = 500, message = "must be at most 500 characters") String notes) {}
