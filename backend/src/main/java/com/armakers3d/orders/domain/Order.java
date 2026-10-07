package com.armakers3d.orders.domain;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.shared.error.ValidationFailedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Order aggregate (contract review 4.6). Immutable. {@code id} is the business code
 * {@code PED-######}. The total is derived from the lines, never stored independently, so the two
 * cannot disagree. {@code registeredBy} is set only for personalized orders. {@code history} is the
 * append-only status history, oldest first; its last entry always equals {@code status}. No payment
 * fields exist on purpose (PD-ORD-01).
 */
public record Order(
        String id,
        Long customerId,
        OrderKind kind,
        OrderStatus status,
        List<OrderLine> lines,
        DeliveryInfo delivery,
        ContactInfo contact,
        Instant createdAt,
        Long registeredBy,
        List<StatusHistoryEntry> history) {

    /** Status every standard order starts in (docs/architecture/order-lifecycle.md). */
    public static final OrderStatus INITIAL_STANDARD_STATUS = OrderStatus.CONFIRMADO;

    /** Status of a staff-registered personalized order: payment was attested before registration (order-lifecycle.md). */
    public static final OrderStatus INITIAL_PERSONALIZED_STATUS = OrderStatus.CONFIRMADO;

    /** Maximum length of the optional note on a status change (contract E26). */
    public static final int NOTE_MAX_LENGTH = 500;

    public Order {
        lines = List.copyOf(lines);
        history = List.copyOf(history);
    }

    /** A new standard catalog order in its initial status; the customer is the actor of the creation entry. */
    public static Order placeStandard(
            String id, Long customerId, List<OrderLine> lines, DeliveryInfo delivery, ContactInfo contact, Instant now) {
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("An order needs at least one line");
        }
        return new Order(id, customerId, OrderKind.ESTANDAR, INITIAL_STANDARD_STATUS, lines, delivery, contact, now, null,
                List.of(new StatusHistoryEntry(null, INITIAL_STANDARD_STATUS, customerId, Rol.CLIENTE, now, null)));
    }

    /**
     * A personalized order registered by staff after the external quotation and payment (CLAUDE.md). One
     * line: the description with the AGREED amount as unit price, quantity 1. No delivery or contact
     * snapshot (not in the contract, E27). {@code registeredBy} is the staff account id; it is also the
     * actor of the creation history entry.
     */
    public static Order registerPersonalized(
            String id, Long customerId, Long registeredBy, Rol staffRole, String description,
            BigDecimal agreedAmount, Instant now) {
        return new Order(
                id, customerId, OrderKind.PERSONALIZADO, INITIAL_PERSONALIZED_STATUS,
                List.of(new OrderLine(null, description, agreedAmount, 1)), null, null, now, registeredBy,
                List.of(new StatusHistoryEntry(null, INITIAL_PERSONALIZED_STATUS, registeredBy, staffRole, now, null)));
    }

    /**
     * Applies a status change and returns the NEW immutable order with one more history entry. The
     * transition table lives in {@link OrderStatus}; any pair outside it (including same to same and any
     * change out of a terminal status) throws {@link InvalidStatusTransitionException}. The caller has
     * already authorized the actor; the domain only records who did it.
     */
    public Order transitionTo(OrderStatus newStatus, Long actorId, Rol actorRole, String note, Instant now) {
        if (!status.canTransitionTo(newStatus)) {
            throw new InvalidStatusTransitionException(status, newStatus);
        }
        String cleanNote = normalizeNote(note);
        List<StatusHistoryEntry> entries = new ArrayList<>(history);
        entries.add(new StatusHistoryEntry(status, newStatus, actorId, actorRole, now, cleanNote));
        return new Order(id, customerId, kind, newStatus, lines, delivery, contact, createdAt, registeredBy, entries);
    }

    /** Trims; blank becomes null; rejects over-long text and control characters (log and display safety). */
    static String normalizeNote(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > NOTE_MAX_LENGTH) {
            throw new ValidationFailedException("note", "must be at most " + NOTE_MAX_LENGTH + " characters");
        }
        if (trimmed.chars().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) {
            throw new ValidationFailedException("note", "must not contain control characters");
        }
        return trimmed;
    }

    public BigDecimal total() {
        return lines.stream().map(OrderLine::lineTotal).reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    public int totalUnits() {
        return lines.stream().mapToInt(OrderLine::quantity).sum();
    }

    public boolean belongsTo(Long clienteId) {
        return customerId.equals(clienteId);
    }
}
