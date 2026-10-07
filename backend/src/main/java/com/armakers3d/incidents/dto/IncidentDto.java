package com.armakers3d.incidents.dto;

import com.armakers3d.incidents.domain.IncidentStatus;
import java.time.Instant;

/** Contract Incident (4.7), customer-facing. Priority is internal triage and is never exposed here. */
public record IncidentDto(
        String id,
        String orderId,
        String orderSummary,
        String description,
        IncidentStatus status,
        String resolution,
        Instant reportedAt,
        Instant resolvedAt) {}
