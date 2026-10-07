package com.armakers3d.incidents.dto;

import com.armakers3d.incidents.domain.IncidentRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/incidents} (contract E23). Only these two fields exist: status, priority,
 * resolution, owner, id and any other property sent are ignored. The minimum description length is
 * enforced after trimming by {@code IncidentRules}.
 */
public record CreateIncidentRequestDto(
        @NotBlank(message = "is required") @Size(max = IncidentRules.ORDER_ID_MAX, message = "must be at most 30 characters")
                String orderId,
        @NotBlank(message = "is required") @Size(max = IncidentRules.DESCRIPTION_MAX, message = "must be at most 1000 characters")
                String description) {}
