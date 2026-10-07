package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Response of {@code POST /api/orders} and {@code GET /api/orders/{id}}: contract review OrderDetail including {@code statusHistory}
 * and without the contact snapshot (not part of the contract, and not needed by the
 * confirmation page). Money is a JSON number with 2 decimals, PEN implied. Everything here is
 * computed or confirmed by the server.
 */
public record OrderResponseDto(
        String id,
        Instant placedAt,
        OrderStatus status,
        OrderKind kind,
        String summary,
        BigDecimal totalAmount,
        List<Item> items,
        Delivery delivery,
        List<OrderHistoryEntryDto> statusHistory) {

    public record Item(Long productId, String title, BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}

    public record Delivery(String address, String district, String notes) {}
}
