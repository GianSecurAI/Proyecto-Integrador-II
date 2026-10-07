/**
 * Payments domain (ADR-005, supersedes the gateway design of ADR-003): standard catalog checkout paid by Yape or
 * Plin OUTSIDE the system. The customer scans the QR (a frontend asset), uploads a screenshot of the payment and an
 * administrator verifies it; only an approval creates the order. Owns the {@code Checkout} aggregate
 * (AWAITING_PAYMENT_PROOF, PROOF_SUBMITTED, PAID, PROOF_REJECTED, EXPIRED, CANCELLED) with its proof attempts, the
 * {@code ProofStorage} port, the upload inspection (magic bytes, size, hash) and the expiry job. Depends on
 * {@code catalog} (service: authoritative price and availability), {@code orders} (service: create the order from an
 * approved payment) and {@code shared}; {@code orders} never depends on it. There is no payment provider, no webhook
 * and no secret.
 */
package com.armakers3d.payments;
