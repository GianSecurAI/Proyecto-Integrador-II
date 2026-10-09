package com.armakers3d.quotations.dto;

import com.armakers3d.quotations.domain.QuotationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code PATCH /api/admin/quotations/{id}/status}. */
public record QuotationStatusRequestDto(
        @NotNull(message = "status is required") QuotationStatus status,
        @Size(max = 500, message = "must be at most 500 characters") String notes) {}
