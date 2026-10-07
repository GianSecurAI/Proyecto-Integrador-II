package com.armakers3d.orders.service;

import com.armakers3d.auth.domain.Rol;
import java.math.BigDecimal;

/** Input of {@code PersonalizedOrderService}; the staff identity comes from the principal, never the body. */
public record RegisterPersonalizedOrderCommand(
        Long staffId,
        String staffEmail,
        Rol staffRole,
        String idempotencyKey,
        String customerEmail,
        String description,
        BigDecimal agreedAmount,
        Boolean paymentConfirmed) {}
