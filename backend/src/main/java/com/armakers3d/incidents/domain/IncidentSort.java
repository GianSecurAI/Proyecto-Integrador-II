package com.armakers3d.incidents.domain;

import com.armakers3d.shared.error.MalformedRequestException;
import java.util.Comparator;

/** Whitelisted sort: only {@code reportedAt} (contract E22/E28), optional {@code ,asc|desc}; default reportedAt desc. */
public record IncidentSort(boolean descending) {

    public static final IncidentSort DEFAULT = new IncidentSort(true);

    public static IncidentSort parse(String sort) {
        if (sort == null || sort.isBlank()) {
            return DEFAULT;
        }
        String[] parts = sort.split(",", -1);
        boolean directionOk = parts.length == 1
                || (parts.length == 2
                        && ("asc".equalsIgnoreCase(parts[1].trim()) || "desc".equalsIgnoreCase(parts[1].trim())));
        if (!"reportedAt".equals(parts[0].trim()) || !directionOk) {
            throw new MalformedRequestException("sort must be reportedAt optionally followed by ,asc or ,desc.");
        }
        return new IncidentSort(parts.length == 2 ? "desc".equalsIgnoreCase(parts[1].trim()) : true);
    }

    /** Stable total order: creation instant, then id, in the chosen direction. */
    public Comparator<Incident> comparator() {
        Comparator<Incident> c = Comparator.comparing(Incident::createdAt).thenComparing(Incident::id);
        return descending ? c.reversed() : c;
    }
}
