package com.armakers3d.reports.infrastructure.inmemory;

import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.service.OrderReportFeed;
import com.armakers3d.reports.repository.OrderReportSource;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Computes the order aggregates in memory from the facts the {@code orders} module exposes
 * ({@link OrderReportFeed}). Replace with a SQL GROUP BY adapter once the database exists (PD-REP-04).
 */
@Component
public class InMemoryOrderReportSource implements OrderReportSource {

    private final OrderReportFeed feed;

    public InMemoryOrderReportSource(OrderReportFeed feed) {
        this.feed = feed;
    }

    @Override
    public OrderAggregate aggregate(Query query) {
        Map<OrderStatus, Long> byStatus = new EnumMap<>(OrderStatus.class);
        Map<OrderKind, Long> byKind = new EnumMap<>(OrderKind.class);
        Map<OrderKind, BigDecimal> amounts = new EnumMap<>(OrderKind.class);
        for (OrderStatus s : OrderStatus.values()) {
            byStatus.put(s, 0L);
        }
        for (OrderKind k : OrderKind.values()) {
            byKind.put(k, 0L);
            amounts.put(k, BigDecimal.ZERO.setScale(2));
        }
        for (var fact : feed.facts(query.from(), query.toExclusive(), query.status())) {
            byStatus.merge(fact.status(), 1L, Long::sum);
            byKind.merge(fact.kind(), 1L, Long::sum);
            if (fact.status() != OrderStatus.CANCELADO) {
                amounts.merge(fact.kind(), fact.total(), BigDecimal::add);
            }
        }
        return new OrderAggregate(byStatus, byKind, amounts);
    }
}
