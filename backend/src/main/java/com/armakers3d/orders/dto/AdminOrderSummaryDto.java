package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;

/** Contract AdminOrderSummary (E24): OrderSummary plus the owner's contact data (name and phone are null when the profile is empty). */
public record AdminOrderSummaryDto(
        String id,
        Instant placedAt,
        OrderStatus status,
        OrderKind kind,
        String summary,
        BigDecimal totalAmount,
        String customerEmail,
        String customerName,
        String customerPhone) {}
