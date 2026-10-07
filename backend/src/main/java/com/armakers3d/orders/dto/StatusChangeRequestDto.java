package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PATCH /api/admin/orders/{orderId}/status} (contract E26). Only these two fields exist;
 * any other property sent (actor, role, timestamps, previous status) is ignored. The actor comes from the principal.
 */
public record StatusChangeRequestDto(
        @NotNull(message = "is required") OrderStatus status,
        @Size(max = 500, message = "must be at most 500 characters") String note) {}
