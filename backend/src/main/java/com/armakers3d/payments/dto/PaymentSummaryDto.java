package com.armakers3d.payments.dto;

import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * One row of {@code GET /api/admin/payments} (ADMINISTRADOR). {@code submittedAt} is when the latest proof arrived
 * (null if none); the queue is sorted oldest first by it. {@code duplicateProofWarning} is true when the latest proof
 * is byte-identical to a proof of ANOTHER checkout.
 */
public record PaymentSummaryDto(
        String checkoutId,
        String reference,
        CheckoutStatus status,
        String customerName,
        BigDecimal totalAmount,
        String currency,
        Instant createdAt,
        Instant submittedAt,
        int attemptCount,
        PaymentMethod method,
        boolean duplicateProofWarning) {}
