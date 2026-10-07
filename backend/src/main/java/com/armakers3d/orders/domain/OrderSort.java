package com.armakers3d.orders.domain;

import com.armakers3d.shared.error.MalformedRequestException;
import java.util.Comparator;

/** Whitelisted sort: only {@code placedAt} (contract E20/E24), optional {@code ,asc|desc}; default placedAt desc. */
public record OrderSort(boolean descending) {

    public static final OrderSort DEFAULT = new OrderSort(true);

    public static OrderSort parse(String sort) {
        if (sort == null || sort.isBlank()) {
            return DEFAULT;
        }
        String[] parts = sort.split(",", -1);
        boolean directionOk = parts.length == 1
                || (parts.length == 2
                        && ("asc".equalsIgnoreCase(parts[1].trim()) || "desc".equalsIgnoreCase(parts[1].trim())));
        if (!"placedAt".equals(parts[0].trim()) || !directionOk) {
            throw new MalformedRequestException("sort must be placedAt optionally followed by ,asc or ,desc.");
        }
        return new OrderSort(parts.length == 2 ? "desc".equalsIgnoreCase(parts[1].trim()) : true);
    }

    /** Stable total order: creation instant, then id, in the chosen direction. */
    public Comparator<Order> comparator() {
        Comparator<Order> c = Comparator.comparing(Order::createdAt).thenComparing(Order::id);
        return descending ? c.reversed() : c;
    }
}
