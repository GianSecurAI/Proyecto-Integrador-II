package com.armakers3d.payments.domain;

/**
 * Lifecycle of a {@link Checkout} (ADR-005). "Waiting for payment" lives here, never in the order lifecycle.
 * <pre>
 * AWAITING_PAYMENT_PROOF -> PROOF_SUBMITTED -> PAID            (administrator approved; the order is created)
 *                                           -> PROOF_REJECTED  (administrator rejected; the customer may upload again)
 * AWAITING_PAYMENT_PROOF -> EXPIRED   (24 h without any proof; once a proof exists the checkout never expires)
 * AWAITING_PAYMENT_PROOF | PROOF_SUBMITTED | PROOF_REJECTED -> CANCELLED (customer, before PAID)
 * PROOF_REJECTED -> PROOF_SUBMITTED (new proof)
 * </pre>
 * PAID, EXPIRED and CANCELLED are terminal. Every change is a compare-and-set on the current status.
 */
public enum CheckoutStatus {
    AWAITING_PAYMENT_PROOF,
    PROOF_SUBMITTED,
    PAID,
    PROOF_REJECTED,
    EXPIRED,
    CANCELLED;

    public boolean canTransitionTo(CheckoutStatus target) {
        return switch (this) {
            case AWAITING_PAYMENT_PROOF -> target == PROOF_SUBMITTED || target == EXPIRED || target == CANCELLED;
            case PROOF_SUBMITTED -> target == PAID || target == PROOF_REJECTED || target == CANCELLED;
            case PROOF_REJECTED -> target == PROOF_SUBMITTED || target == CANCELLED;
            case PAID, EXPIRED, CANCELLED -> false;
        };
    }
}
