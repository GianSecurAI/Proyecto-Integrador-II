package com.armakers3d.incidents.dto;

import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;

/**
 * Body of {@code PATCH /api/admin/incidents/{incidentId}} (contract E30): at least one of the two fields
 * (checked by the service). RESUELTA is not settable here (resolution action only).
 */
public record UpdateIncidentRequestDto(IncidentStatus status, IncidentPriority priority) {}
