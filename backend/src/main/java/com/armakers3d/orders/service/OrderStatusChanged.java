package com.armakers3d.orders.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.time.Instant;

/**
 * In-process notification hook (stage 11 attaches email sending to it with a plain
 * {@code @EventListener}; the orders code knows nothing about email). Published AFTER the order was
 * stored: on creation ({@code previousStatus == null}) and on every successful status change. Ids and
 * statuses only: no email, name, address, note or amount travels in it. With no listener registered
 * (today) publishing is a no-op. Listener failures never affect the order operation
 * (see {@link OrderEventPublisher}).
 */
public record OrderStatusChanged(
        String orderId,
        Long customerId,
        OrderKind kind,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        Long actorId,
        Rol actorRole,
        Instant occurredAt) {}
