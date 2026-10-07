package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.mapper.OrderDtoMapper;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.error.NotFoundException;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Narrow public API of {@code orders} for other modules (today: {@code incidents}), so they never touch
 * the order repository. Ownership follows the order convention: an unknown order and an order owned by
 * someone else are the SAME {@code 404 NOT_FOUND}.
 */
@Service
public class OrderLookupService {

    /** What another module may know about an order: its code, owner and the presentation summary. */
    public record OrderBrief(String id, Long customerId, String summary) {}

    private final OrderRepository orders;

    public OrderLookupService(OrderRepository orders) {
        this.orders = orders;
    }

    public OrderBrief requireOwned(Long customerId, String orderId) {
        Order order = orders.findById(orderId)
                .filter(o -> o.belongsTo(customerId))
                .orElseThrow(() -> new NotFoundException("Order not found."));
        return new OrderBrief(order.id(), order.customerId(), OrderDtoMapper.summary(order));
    }

    /** Summaries by order code; unknown codes are absent from the result. */
    public Map<String, String> summariesByIds(Collection<String> orderIds) {
        Map<String, String> result = new HashMap<>();
        for (String id : Set.copyOf(orderIds)) {
            orders.findById(id).ifPresent(o -> result.put(id, OrderDtoMapper.summary(o)));
        }
        return result;
    }
}
