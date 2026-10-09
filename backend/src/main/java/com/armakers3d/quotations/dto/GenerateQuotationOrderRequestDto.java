package com.armakers3d.quotations.dto;

import jakarta.validation.constraints.NotNull;

/** Body of {@code POST /api/admin/quotations/{id}/order}: staff confirm that the external payment was received. */
public record GenerateQuotationOrderRequestDto(@NotNull Boolean paymentConfirmed) {}
