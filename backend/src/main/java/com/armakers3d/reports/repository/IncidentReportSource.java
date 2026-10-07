package com.armakers3d.reports.repository;

import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import java.time.Instant;
import java.util.Map;

/**
 * Report-queries PORT for incidents (PD-REP-04). Aggregates only. Window: {@code from <= reportedAt <
 * toExclusive}; {@code status} optional. The count maps contain EVERY enum value (zero when none).
 */
public interface IncidentReportSource {

    record Query(Instant from, Instant toExclusive, IncidentStatus status) {}

    record IncidentAggregate(Map<IncidentStatus, Long> countByStatus, Map<IncidentPriority, Long> countByPriority) {}

    IncidentAggregate aggregate(Query query);
}
