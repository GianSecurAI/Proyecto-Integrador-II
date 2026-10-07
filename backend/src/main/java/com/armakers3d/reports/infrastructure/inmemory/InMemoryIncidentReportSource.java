package com.armakers3d.reports.infrastructure.inmemory;

import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.service.IncidentReportFeed;
import com.armakers3d.reports.repository.IncidentReportSource;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Computes the incident aggregates in memory from {@link IncidentReportFeed} (PD-REP-04). */
@Component
public class InMemoryIncidentReportSource implements IncidentReportSource {

    private final IncidentReportFeed feed;

    public InMemoryIncidentReportSource(IncidentReportFeed feed) {
        this.feed = feed;
    }

    @Override
    public IncidentAggregate aggregate(Query query) {
        Map<IncidentStatus, Long> byStatus = new EnumMap<>(IncidentStatus.class);
        Map<IncidentPriority, Long> byPriority = new EnumMap<>(IncidentPriority.class);
        for (IncidentStatus s : IncidentStatus.values()) {
            byStatus.put(s, 0L);
        }
        for (IncidentPriority p : IncidentPriority.values()) {
            byPriority.put(p, 0L);
        }
        for (var fact : feed.facts(query.from(), query.toExclusive(), query.status())) {
            byStatus.merge(fact.status(), 1L, Long::sum);
            byPriority.merge(fact.priority(), 1L, Long::sum);
        }
        return new IncidentAggregate(byStatus, byPriority);
    }
}
