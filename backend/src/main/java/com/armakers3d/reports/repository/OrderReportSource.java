package com.armakers3d.reports.repository;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Report-queries PORT for orders (PD-REP-04). Returns aggregates, never rows, so a SQL {@code GROUP BY} adapter can
 * replace the in-memory one without touching the service. Window: {@code from <= createdAt < toExclusive};
 * {@code status} optional. Behavior every adapter must have: the count maps contain EVERY enum value (zero when
 * none); {@code amountByKind} sums the server-calculated order totals of every order that is NOT
 * {@code CANCELADO} (PD-REP-03), zero (scale 2) when none.
 */
public interface OrderReportSource {

    record Query(Instant from, Instant toExclusive, OrderStatus status) {}

    record OrderAggregate(
            Map<OrderStatus, Long> countByStatus,
            Map<OrderKind, Long> countByKind,
            Map<OrderKind, BigDecimal> amountByKind) {}

    OrderAggregate aggregate(Query query);
}
