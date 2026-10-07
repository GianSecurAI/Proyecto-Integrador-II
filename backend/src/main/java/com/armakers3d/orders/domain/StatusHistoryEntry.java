package com.armakers3d.orders.domain;

import com.armakers3d.auth.domain.Rol;
import java.time.Instant;

/**
 * One immutable, append-only entry of the status history (contract review OrderHistoryEntry,
 * discovery HistorialEstadoPedido). {@code fromStatus} is null only for the creation entry.
 * {@code actorId}/{@code actorRole} identify the account that caused the change (the customer for a
 * standard checkout, the staff member otherwise); the SPA-facing "responsible" label is derived from
 * them in the mapper. {@code note} is optional, trimmed, at most {@link Order#NOTE_MAX_LENGTH}.
 */
public record StatusHistoryEntry(
        OrderStatus fromStatus, OrderStatus toStatus, Long actorId, Rol actorRole, Instant at, String note) {}
