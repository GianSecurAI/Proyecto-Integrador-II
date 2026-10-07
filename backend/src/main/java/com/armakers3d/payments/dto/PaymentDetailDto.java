package com.armakers3d.payments.dto;

import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofDecision;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * {@code GET /api/admin/payments/{checkoutId}} and the answer of approve/reject (ADMINISTRADOR): what the
 * administrator needs to compare the screenshot with the wallet app (customer name and phone, exact amount,
 * reference, lines, every attempt with its decision). {@code duplicateProofWarning} is true when any proof equals a
 * proof of another checkout; each attempt carries its own flag. No storage key or hash is exposed.
 */
public record PaymentDetailDto(
        String checkoutId,
        String reference,
        CheckoutStatus status,
        String orderId,
        Long customerId,
        Contact contact,
        BigDecimal totalAmount,
        String currency,
        Instant createdAt,
        Instant paidAt,
        List<CheckoutDto.Item> items,
        List<Attempt> attempts,
        boolean duplicateProofWarning) {

    public record Contact(String fullName, String phone) {}

    public record Attempt(
            String attemptId,
            int number,
            PaymentMethod method,
            String operationCode,
            Instant submittedAt,
            String contentType,
            long sizeBytes,
            ProofDecision decision,
            String rejectionReason,
            Long decidedBy,
            Instant decidedAt,
            boolean duplicateProofWarning) {}
}
