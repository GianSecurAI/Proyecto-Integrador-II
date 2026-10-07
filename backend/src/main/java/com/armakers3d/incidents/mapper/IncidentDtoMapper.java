package com.armakers3d.incidents.mapper;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.dto.AdminIncidentDto;
import com.armakers3d.incidents.dto.IncidentDto;
import com.armakers3d.incidents.service.IncidentAdminService.StaffIncidentView;
import com.armakers3d.incidents.service.IncidentService.CustomerIncidentView;

/** Domain incident to wire shape. Only contract fields are copied; the owner id is never exposed. */
public final class IncidentDtoMapper {

    private IncidentDtoMapper() {}

    public static IncidentDto toDto(CustomerIncidentView v) {
        Incident i = v.incident();
        return new IncidentDto(
                i.id(), i.orderId(), v.orderSummary(), i.description(), i.status(), i.resolution(), i.createdAt(),
                i.resolvedAt());
    }

    public static AdminIncidentDto toAdminDto(StaffIncidentView v) {
        Incident i = v.incident();
        var c = v.customer();
        return new AdminIncidentDto(
                i.id(), i.orderId(), v.orderSummary(), i.description(), i.status(), i.priority(), i.resolution(),
                i.createdAt(), i.updatedAt(), i.resolvedAt(),
                c == null ? null : c.email(), c == null ? null : c.name(), c == null ? null : c.phone(), i.status().allowedNext());
    }
}
