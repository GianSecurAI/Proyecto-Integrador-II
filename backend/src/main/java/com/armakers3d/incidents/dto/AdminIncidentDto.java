package com.armakers3d.incidents.dto;

import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import java.time.Instant;

/**
 * Contract AdminIncident (4.9): Incident plus priority and the owner's contact data (name and phone are null
 * when the profile is empty). {@code updatedAt} is an additive field not in the review (PD-INC-07).
 */
public record AdminIncidentDto(
        String id,
        String orderId,
        String orderSummary,
        String description,
        IncidentStatus status,
        IncidentPriority priority,
        String resolution,
        Instant reportedAt,
        Instant updatedAt,
        Instant resolvedAt,
        String customerEmail,
        String customerName,
        String customerPhone) {}
