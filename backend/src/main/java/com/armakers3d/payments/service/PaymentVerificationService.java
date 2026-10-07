package com.armakers3d.payments.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.service.OrderService;
import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.domain.ProofAttempt;
import com.armakers3d.payments.repository.CheckoutRepository;
import com.armakers3d.payments.service.exception.CheckoutStateException;
import com.armakers3d.shared.error.NotFoundException;
import com.armakers3d.shared.error.ValidationFailedException;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.time.Clock;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Administrator side of the manual payment verification (ADR-005). THE single place a payment becomes an order:
 * {@link #approve} moves the checkout to PAID with a compare-and-set and creates the standard order through
 * {@link OrderService#placeStandardOrderFromCheckout} (unique per checkout), so any number of concurrent or repeated
 * approvals produce exactly one order and one CONFIRMADO email. {@link #reject} records the reason and tells the
 * customer. The actor is always the authenticated principal. Authorization (ADMINISTRADOR only) is the central role
 * matrix; there is no object-level ownership for staff. Logs carry ids only, never the reason text or file data.
 */
@Service
public class PaymentVerificationService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.payments");
    static final int REASON_MAX = 300;

    /** A checkout plus which of its attempts are byte-identical to a proof of ANOTHER checkout. */
    public record PaymentView(Checkout checkout, Set<String> duplicateAttemptIds) {
        public boolean hasDuplicate() {
            return !duplicateAttemptIds.isEmpty();
        }

        public boolean isDuplicate(String attemptId) {
            return duplicateAttemptIds.contains(attemptId);
        }
    }

    private final CheckoutRepository checkouts;
    private final OrderService orders;
    private final PaymentProofService proofs;
    private final PaymentEventPublisher events;
    private final Clock clock;

    public PaymentVerificationService(
            CheckoutRepository checkouts, OrderService orders, PaymentProofService proofs, PaymentEventPublisher events,
            Clock clock) {
        this.checkouts = checkouts;
        this.orders = orders;
        this.proofs = proofs;
        this.events = events;
        this.clock = clock;
    }

    /** The verification queue: checkouts in {@code status}, oldest proof first. */
    public Page<PaymentView> list(CheckoutStatus status, PageRequest page) {
        List<Checkout> all = checkouts.findByStatus(status).stream()
                .sorted(Comparator.comparing(Checkout::queueSince).thenComparing(Checkout::id))
                .toList();
        return Page.of(all, page).map(this::view);
    }

    public PaymentView detail(String checkoutId) {
        return view(find(checkoutId));
    }

    public ProofContent proof(String checkoutId, String attemptId) {
        return proofs.content(find(checkoutId), attemptId);
    }

    /**
     * Approves the latest proof. Idempotent: approving an already PAID checkout returns it (and makes sure its order
     * exists) without creating anything again. Any other state is a 409.
     */
    public PaymentView approve(Long adminId, Rol adminRole, String checkoutId) {
        Checkout current = find(checkoutId);
        if (current.status() == CheckoutStatus.PROOF_SUBMITTED) {
            Checkout paid = current.approved(adminId, clock.instant());
            if (checkouts.replaceIfStatus(paid, CheckoutStatus.PROOF_SUBMITTED)) {
                audit.info("payment.approved actor={} checkout={}", adminId, LogMasks.checkout(paid.id()));
                current = paid;
            } else {
                current = find(checkoutId); // a concurrent approval, rejection or cancellation won
            }
        }
        if (current.status() != CheckoutStatus.PAID) {
            audit.warn("payment.approve.invalid_state actor={} checkout={} status={}", adminId,
                    LogMasks.checkout(current.id()), current.status());
            throw new CheckoutStateException("Only a checkout with a submitted payment proof can be approved.");
        }
        ensureOrder(current, adminRole);
        return view(find(checkoutId));
    }

    public PaymentView reject(Long adminId, String checkoutId, String rawReason) {
        String reason = normalizeReason(rawReason);
        Checkout current = find(checkoutId);
        if (current.status() != CheckoutStatus.PROOF_SUBMITTED) {
            audit.warn("payment.reject.invalid_state actor={} checkout={} status={}", adminId,
                    LogMasks.checkout(current.id()), current.status());
            throw new CheckoutStateException("Only a checkout with a submitted payment proof can be rejected.");
        }
        Checkout rejected = current.rejected(adminId, reason, clock.instant());
        if (!checkouts.replaceIfStatus(rejected, CheckoutStatus.PROOF_SUBMITTED)) {
            throw new CheckoutStateException("Only a checkout with a submitted payment proof can be rejected.");
        }
        ProofAttempt decided = rejected.latestAttempt().orElseThrow();
        audit.info("payment.rejected actor={} checkout={} attempt={} number={}", adminId, LogMasks.checkout(rejected.id()),
                decided.id(), decided.number());
        events.publish(new PaymentProofRejected(rejected.id(), rejected.customerId(), reason, clock.instant()));
        return view(rejected);
    }

    /**
     * Creates the order of a PAID checkout if it does not exist and records its id on the checkout. Safe to run any
     * number of times and concurrently (unique order per checkout); also completes an approval interrupted between
     * the status change and the order creation.
     */
    private void ensureOrder(Checkout paid, Rol adminRole) {
        var placed = orders.placeStandardOrderFromCheckout(new OrderService.PlaceFromCheckoutCommand(
                paid.id(), paid.customerId(),
                paid.lines().stream().map(l -> new OrderLine(l.productId(), l.title(), l.unitPrice(), l.quantity())).toList(),
                paid.delivery(), paid.contact(), paid.reference(), paid.approvedBy(), adminRole));
        if (paid.orderId() == null) {
            checkouts.replaceIfStatus(paid.withOrder(placed.order().id()), CheckoutStatus.PAID);
        }
        if (placed.created()) {
            audit.info("payment.order_created actor={} checkout={} order={}", paid.approvedBy(),
                    LogMasks.checkout(paid.id()), placed.order().id());
        }
    }

    private Checkout find(String checkoutId) {
        return CheckoutIds.parse(checkoutId).flatMap(checkouts::findById)
                .orElseThrow(() -> new NotFoundException("Checkout not found."));
    }

    private PaymentView view(Checkout checkout) {
        Set<String> duplicates = new HashSet<>();
        for (ProofAttempt attempt : checkout.attempts()) {
            boolean elsewhere = checkouts.findCheckoutIdsByProofHash(attempt.sha256()).stream()
                    .anyMatch(id -> !id.equals(checkout.id()));
            if (elsewhere) {
                duplicates.add(attempt.id());
            }
        }
        return new PaymentView(checkout, duplicates);
    }

    /** Trimmed, required, 1..300 characters, no control characters (it is shown to the customer and e-mailed). */
    static String normalizeReason(String raw) {
        String reason = raw == null ? "" : raw.trim();
        if (reason.isEmpty()) {
            throw new ValidationFailedException("reason", "is required");
        }
        if (reason.length() > REASON_MAX) {
            throw new ValidationFailedException("reason", "must be at most " + REASON_MAX + " characters");
        }
        if (reason.chars().anyMatch(Character::isISOControl)) {
            throw new ValidationFailedException("reason", "must not contain control characters");
        }
        return reason;
    }
}
