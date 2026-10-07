package com.armakers3d.payments.domain;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.UnaryOperator;

/**
 * Checkout aggregate (ADR-005). Immutable; every change returns a new instance and is stored with a
 * compare-and-set on the status. {@code id} is a random UUID (not guessable). The total is derived from the line
 * snapshot taken from the catalog by the server, never stored independently. {@code attempts} is the append-only
 * history of uploaded proofs with the administrator's decisions (oldest first). {@code orderId}, {@code paidAt} and
 * {@code approvedBy} are set when the administrator approves. {@code expiresAt} only matters while the checkout is
 * AWAITING_PAYMENT_PROOF. Stores no card, wallet or bank data.
 */
public record Checkout(
        String id,
        Long customerId,
        CheckoutStatus status,
        List<CheckoutLine> lines,
        DeliveryInfo delivery,
        ContactInfo contact,
        Instant createdAt,
        Instant expiresAt,
        List<ProofAttempt> attempts,
        String orderId,
        Instant paidAt,
        Long approvedBy) {

    /** Only currency supported (ADR-004 2.9). */
    public static final String CURRENCY = "PEN";

    public Checkout {
        lines = List.copyOf(lines);
        attempts = List.copyOf(attempts);
    }

    public static Checkout awaitingProof(
            String id, Long customerId, List<CheckoutLine> lines, DeliveryInfo delivery, ContactInfo contact,
            Instant now, Instant expiresAt) {
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("A checkout needs at least one line");
        }
        return new Checkout(id, customerId, CheckoutStatus.AWAITING_PAYMENT_PROOF, lines, delivery, contact, now,
                expiresAt, List.of(), null, null, null);
    }

    public BigDecimal total() {
        return lines.stream().map(CheckoutLine::lineTotal).reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    /**
     * Short payment reference the customer can put in the wallet note and staff match against; derived from the
     * id and also stored on the order as its payment reference. Not secret and not an access token.
     */
    public String reference() {
        return "AM3D-" + id.substring(0, 8).toUpperCase(Locale.ROOT);
    }

    public boolean belongsTo(Long clienteId) {
        return customerId.equals(clienteId);
    }

    /** Open = counts toward the per-customer cap: not terminal, and (when still without proof) not past its expiry. */
    public boolean isOpen(Instant now) {
        return switch (status) {
            case AWAITING_PAYMENT_PROOF -> expiresAt.isAfter(now);
            case PROOF_SUBMITTED, PROOF_REJECTED -> true;
            default -> false;
        };
    }

    /** True only for a checkout still without any proof whose 24 h are over. */
    public boolean isPastExpiry(Instant now) {
        return status == CheckoutStatus.AWAITING_PAYMENT_PROOF && !expiresAt.isAfter(now);
    }

    public Optional<ProofAttempt> latestAttempt() {
        return attempts.isEmpty() ? Optional.empty() : Optional.of(attempts.get(attempts.size() - 1));
    }

    public Optional<ProofAttempt> attempt(String attemptId) {
        return attempts.stream().filter(a -> a.id().equals(attemptId)).findFirst();
    }

    /** When the checkout entered the verification queue: its latest proof, or its creation. */
    public Instant queueSince() {
        return latestAttempt().map(ProofAttempt::submittedAt).orElse(createdAt);
    }

    public Checkout withProof(ProofAttempt attempt) {
        List<ProofAttempt> next = new ArrayList<>(attempts);
        next.add(attempt);
        return transition(CheckoutStatus.PROOF_SUBMITTED, next, orderId, paidAt, approvedBy);
    }

    public Checkout approved(Long adminId, Instant now) {
        return transition(CheckoutStatus.PAID, decideLatest(a -> a.approvedBy(adminId, now)), orderId, now, adminId);
    }

    public Checkout rejected(Long adminId, String reason, Instant now) {
        return transition(CheckoutStatus.PROOF_REJECTED, decideLatest(a -> a.rejectedBy(adminId, reason, now)), orderId,
                paidAt, approvedBy);
    }

    public Checkout cancelled() {
        return transition(CheckoutStatus.CANCELLED, attempts, orderId, paidAt, approvedBy);
    }

    public Checkout expired() {
        return transition(CheckoutStatus.EXPIRED, attempts, orderId, paidAt, approvedBy);
    }

    /** Records the order created for this (already PAID) checkout; status unchanged. */
    public Checkout withOrder(String newOrderId) {
        if (status != CheckoutStatus.PAID) {
            throw new IllegalStateException("Only a PAID checkout has an order");
        }
        return new Checkout(id, customerId, status, lines, delivery, contact, createdAt, expiresAt, attempts,
                newOrderId, paidAt, approvedBy);
    }

    private List<ProofAttempt> decideLatest(UnaryOperator<ProofAttempt> decision) {
        if (attempts.isEmpty()) {
            throw new IllegalStateException("No proof to decide");
        }
        List<ProofAttempt> next = new ArrayList<>(attempts);
        int last = next.size() - 1;
        next.set(last, decision.apply(next.get(last)));
        return next;
    }

    private Checkout transition(
            CheckoutStatus target, List<ProofAttempt> newAttempts, String newOrderId, Instant newPaidAt, Long newApprovedBy) {
        if (!status.canTransitionTo(target)) {
            throw new IllegalStateException("Illegal checkout transition " + status + " -> " + target);
        }
        return new Checkout(id, customerId, target, lines, delivery, contact, createdAt, expiresAt, newAttempts,
                newOrderId, newPaidAt, newApprovedBy);
    }
}
