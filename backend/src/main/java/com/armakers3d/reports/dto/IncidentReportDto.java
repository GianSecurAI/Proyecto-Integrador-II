package com.armakers3d.reports.dto;

import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import java.time.LocalDate;
import java.util.List;

/**
 * E33 response. {@code openIncidents} = ABIERTA + EN_REVISION, {@code resolvedIncidents} = RESUELTA; RECHAZADA is in
 * the total and in {@code byStatus} only (PD-REP-05).
 */
public record IncidentReportDto(
        LocalDate from,
        LocalDate to,
        long totalIncidents,
        long openIncidents,
        long resolvedIncidents,
        List<StatusCount> byStatus,
        List<PriorityCount> byPriority) {

    public record StatusCount(IncidentStatus status, long count) {}

    public record PriorityCount(IncidentPriority priority, long count) {}
}
