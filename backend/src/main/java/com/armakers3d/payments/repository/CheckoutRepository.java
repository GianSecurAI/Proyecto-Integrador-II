package com.armakers3d.payments.repository;

import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Port for checkout persistence (ADR-005). Behavior every adapter must have: {@code findById} is empty for unknown
 * ids; {@code insertIfOpenBelow} is atomic per customer (the count of OPEN checkouts and the insert cannot
 * interleave); {@code replaceIfStatus} is an atomic compare-and-set on the current status (the status is the
 * version: every change that appends a proof or decides one also changes the status, except recording the order id
 * of a PAID checkout). Ownership checks belong to the service. A JPA adapter would map this to a {@code checkout}
 * table (+ {@code proof_attempt}) with a status-conditional UPDATE and an index on the proof hash.
 */
public interface CheckoutRepository {

    Optional<Checkout> findById(String id);

    /**
     * Stores {@code checkout} only if its customer has fewer than {@code maxOpen} OPEN checkouts at {@code now}
     * (see {@code Checkout.isOpen}). Returns false and stores nothing otherwise.
     */
    boolean insertIfOpenBelow(Checkout checkout, int maxOpen, Instant now);

    /** Replaces the stored checkout only if it exists and its CURRENT status is {@code expected}. */
    boolean replaceIfStatus(Checkout updated, CheckoutStatus expected);

    /** AWAITING_PAYMENT_PROOF checkouts whose expiry is at or before {@code now}. */
    List<Checkout> findAwaitingProofExpiredAt(Instant now);

    /** Every checkout currently in {@code status} (the admin queue sorts and pages them). */
    List<Checkout> findByStatus(CheckoutStatus status);

    /** Ids of every checkout holding a proof with this SHA-256 (hex): duplicate-screenshot detection. */
    Set<String> findCheckoutIdsByProofHash(String sha256);
}
