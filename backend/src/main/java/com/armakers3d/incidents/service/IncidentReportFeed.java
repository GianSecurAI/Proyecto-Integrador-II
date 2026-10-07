package com.armakers3d.incidents.service;

import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentSearchCriteria;
import com.armakers3d.incidents.domain.IncidentSort;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Narrow read-only public API of {@code incidents} for the {@code reports} module: anonymous facts (no
 * description, resolution, order or customer) of the incidents reported inside a window.
 */
@Service
public class IncidentReportFeed {

    /** What a report may know about an incident. */
    public record IncidentFact(IncidentStatus status, IncidentPriority priority, Instant reportedAt) {}

    private final IncidentRepository incidents;

    public IncidentReportFeed(IncidentRepository incidents) {
        this.incidents = incidents;
    }

    /** Incidents with {@code from <= reportedAt < toExclusive} (null bound = open) and, optionally, one status. */
    public List<IncidentFact> facts(Instant from, Instant toExclusive, IncidentStatus status) {
        var criteria = new IncidentSearchCriteria(null, status, null, null, from, toExclusive);
        IncidentSort sort = IncidentSort.parse("reportedAt,asc");
        List<IncidentFact> result = new ArrayList<>();
        int pageNumber = 0;
        Page<Incident> page;
        do {
            page = incidents.search(criteria, sort, new PageRequest(pageNumber++, PageRequest.MAX_SIZE));
            page.content().forEach(i -> result.add(new IncidentFact(i.status(), i.priority(), i.createdAt())));
        } while (pageNumber < page.totalPages());
        return result;
    }
}
