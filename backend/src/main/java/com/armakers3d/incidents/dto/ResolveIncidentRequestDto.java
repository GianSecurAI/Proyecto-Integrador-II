package com.armakers3d.incidents.dto;

import com.armakers3d.incidents.domain.IncidentRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/admin/incidents/{incidentId}/resolution} (contract E31). */
public record ResolveIncidentRequestDto(
        @NotBlank(message = "is required") @Size(max = IncidentRules.RESOLUTION_MAX, message = "must be at most 1000 characters")
                String resolutionText) {}
