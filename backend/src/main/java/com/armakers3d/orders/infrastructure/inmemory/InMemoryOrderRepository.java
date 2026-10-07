package com.armakers3d.orders.infrastructure.inmemory;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link OrderRepository}. NOT durable, in EVERY profile (no orders table or migration
 * yet, PD-ORD-04). Selected by {@code app.persistence.orders=memory}; {@code InMemoryStorageGuard}
 * refuses to boot it under {@code prod}. Orders are immutable records. Order codes come from an
 * atomic counter, so they are unique and never reused within a run. The status compare-and-set is
 * atomic through {@link ConcurrentHashMap#computeIfPresent}.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.orders", havingValue = "memory", matchIfMissing = true)
public class InMemoryOrderRepository implements OrderRepository {

    private final Map<String, Order> byId = new ConcurrentHashMap<>();
    private final Map<String, String> byCheckoutId = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public String nextOrderNumber() {
        return String.format("PED-%06d", sequence.incrementAndGet());
    }

    @Override
    public Order save(Order order) {
        byId.put(order.id(), order);
        return order;
    }

    @Override
    public Optional<Order> findById(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public List<Order> findByCustomerId(Long customerId) {
        return byId.values().stream()
                .filter(o -> o.customerId().equals(customerId))
                .sorted(Comparator.comparing(Order::createdAt).thenComparing(Order::id).reversed())
                .toList();
    }

    @Override
    public Page<Order> search(OrderSearchCriteria criteria, OrderSort sort, PageRequest pageRequest) {
        List<Order> matching = byId.values().stream()
                .filter(criteria::matches)
                .sorted(sort.comparator())
                .toList();
        return Page.of(matching, pageRequest);
    }

    @Override
    public synchronized Optional<Order> findByCheckoutId(String checkoutId) {
        String orderId = byCheckoutId.get(checkoutId);
        return orderId == null ? Optional.empty() : Optional.ofNullable(byId.get(orderId));
    }

    @Override
    public synchronized boolean insertIfCheckoutAbsent(Order order) {
        if (order.checkoutId() == null) {
            throw new IllegalArgumentException("An order created for a checkout needs a checkoutId");
        }
        // Synchronized with findByCheckoutId so a loser never sees the claim without the order.
        if (byCheckoutId.putIfAbsent(order.checkoutId(), order.id()) != null) {
            return false;
        }
        byId.put(order.id(), order);
        return true;
    }

    @Override
    public boolean replaceIfStatus(Order updated, OrderStatus expectedCurrent) {
        boolean[] replaced = {false};
        byId.computeIfPresent(updated.id(), (id, current) -> {
            if (current.status() == expectedCurrent) {
                replaced[0] = true;
                return updated;
            }
            return current;
        });
        return replaced[0];
    }
}
