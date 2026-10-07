package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;

/** Contract OrderSummary (E20): one row of the customer order list. */
public record OrderSummaryDto(
        String id, Instant placedAt, OrderStatus status, OrderKind kind, String summary, BigDecimal totalAmount) {}
