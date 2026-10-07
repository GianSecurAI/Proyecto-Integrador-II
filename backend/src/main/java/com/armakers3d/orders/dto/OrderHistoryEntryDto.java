package com.armakers3d.orders.dto;

import com.armakers3d.orders.domain.OrderStatus;
import java.time.Instant;

/** Contract OrderHistoryEntry. {@code responsible} is "Sistema", "Equipo Ar Makers 3D" (customer view) or the staff email (admin view). */
public record OrderHistoryEntryDto(
        OrderStatus previousStatus, OrderStatus newStatus, Instant changedAt, String responsible, String note) {}
