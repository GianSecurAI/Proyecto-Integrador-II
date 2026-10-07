package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Narrow read-only public API of {@code orders} for the {@code reports} module: anonymous facts (no customer, no
 * lines, no contact data) of the orders created inside a window. {@code reports} never touches the order
 * repository or the aggregate.
 */
@Service
public class OrderReportFeed {

    /** What a report may know about an order: status, kind, creation instant and the server-calculated total. */
    public record OrderFact(OrderStatus status, OrderKind kind, Instant createdAt, BigDecimal total) {}

    private final OrderRepository orders;

    public OrderReportFeed(OrderRepository orders) {
        this.orders = orders;
    }

    /** Orders with {@code from <= createdAt < toExclusive} (null bound = open) and, optionally, one status. */
    public List<OrderFact> facts(Instant from, Instant toExclusive, OrderStatus status) {
        var criteria = new OrderSearchCriteria(null, status, null, from, toExclusive, null, null);
        OrderSort sort = OrderSort.parse("placedAt,asc");
        List<OrderFact> result = new ArrayList<>();
        int pageNumber = 0;
        Page<Order> page;
        do {
            page = orders.search(criteria, sort, new PageRequest(pageNumber++, PageRequest.MAX_SIZE));
            page.content().forEach(o -> result.add(new OrderFact(o.status(), o.kind(), o.createdAt(), o.total())));
        } while (pageNumber < page.totalPages());
        return result;
    }
}
