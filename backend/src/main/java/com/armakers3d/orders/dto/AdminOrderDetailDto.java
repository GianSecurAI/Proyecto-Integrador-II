package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Contract AdminOrderDetail (E25, E26, E27): OrderDetail + owner contact + {@code allowedNextStatuses}
 * (server-authoritative, the SPA must use it) + {@code agreedAmount} (personalized only). {@code description}
 * (personalized only) and {@code registeredBy} (staff email, personalized only) are additive.
 * {@code paymentReference} (BE-07) is the Yape/Plin payment reference of a standard order (ADR-005), STAFF ONLY, so
 * staff can match it with the wallet app; null for personalized orders and absent from every customer DTO.
 * No card or payment-method data exists anywhere.
 */
public record AdminOrderDetailDto(
        String id,
        Instant placedAt,
        OrderStatus status,
        OrderKind kind,
        String summary,
        BigDecimal totalAmount,
        BigDecimal agreedAmount,
        String description,
        List<OrderResponseDto.Item> items,
        OrderResponseDto.Delivery delivery,
        String customerEmail,
        String customerName,
        String customerPhone,
        String registeredBy,
        List<OrderHistoryEntryDto> statusHistory,
        List<OrderStatus> allowedNextStatuses,
        String paymentReference) {}
