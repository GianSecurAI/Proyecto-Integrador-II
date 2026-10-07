package com.armakers3d.payments.dto;

import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.PaymentMethod;
import com.armakers3d.payments.domain.ProofDecision;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Customer view of a checkout: the response of {@code POST /api/checkout} (201/200) and of
 * {@code GET /api/checkout/{checkoutId}} / {@code POST .../cancel} / {@code POST .../proof} (ADR-005). Everything is
 * computed by the server. {@code orderId} (PED-######) is non-null only when {@code status} is PAID. {@code expiresAt}
 * is non-null only while AWAITING_PAYMENT_PROOF (a checkout with a proof never expires). {@code proofStatus} is the
 * state of the latest proof: NONE, PENDING, APPROVED or REJECTED; {@code rejectionReason} is set while
 * PROOF_REJECTED. {@code paymentInstructions} carries the amount and the reference to put in the wallet note (the QR
 * images are frontend assets). Never contains storage keys, hashes, other customers' data or the admin identity.
 */
public record CheckoutDto(
        String checkoutId,
        CheckoutStatus status,
        String orderId,
        BigDecimal totalAmount,
        String currency,
        Instant createdAt,
        Instant expiresAt,
        List<Item> items,
        PaymentInstructions paymentInstructions,
        String proofStatus,
        String rejectionReason,
        int attemptsRemaining,
        List<Attempt> attempts) {

    public record Item(Long productId, String title, BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}

    public record PaymentInstructions(List<PaymentMethod> methods, BigDecimal amount, String currency, String reference) {}

    public record Attempt(
            String attemptId, int number, PaymentMethod method, String operationCode, Instant submittedAt,
            ProofDecision status, String rejectionReason) {}
}
