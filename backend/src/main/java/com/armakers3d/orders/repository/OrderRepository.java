package com.armakers3d.orders.repository;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderSearchCriteria;
import com.armakers3d.orders.domain.OrderSort;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.shared.pagination.Page;
import com.armakers3d.shared.pagination.PageRequest;
import java.util.List;
import java.util.Optional;

/**
 * Port for order persistence (backend-foundation.md section 10). Behavior every adapter must have:
 * {@link #nextOrderNumber()} returns a unique business code {@code PED-######} that is never reused;
 * {@code save} stores the order under {@code order.id()} (assigned by the caller from
 * {@code nextOrderNumber()}); {@code findById} is empty for unknown ids; {@code findByCustomerId}
 * returns only that customer's orders, newest first; {@code search} applies
 * {@link OrderSearchCriteria#matches}, orders by {@link OrderSort#comparator()} and pages;
 * {@code replaceIfStatus} is an atomic compare-and-set on the current status (statuses never repeat,
 * so the status is a sufficient version). Ownership checks belong to the service.
 */
public interface OrderRepository {

    String nextOrderNumber();

    Order save(Order order);

    Optional<Order> findById(String id);

    List<Order> findByCustomerId(Long customerId);

    Page<Order> search(OrderSearchCriteria criteria, OrderSort sort, PageRequest pageRequest);

    /**
     * Replaces the stored order with {@code updated} only if it exists and its CURRENT status is
     * {@code expectedCurrent}. Returns false (and changes nothing) otherwise. Atomic: of N concurrent
     * calls with the same expectation exactly one returns true.
     */
    boolean replaceIfStatus(Order updated, OrderStatus expectedCurrent);

    /** The order created from the given checkout (unique), or empty. */
    Optional<Order> findByCheckoutId(String checkoutId);

    /**
     * Stores {@code order} (which carries a non-null {@code checkoutId}) only if NO order exists yet for that
     * checkout; returns false and stores nothing otherwise. Atomic: of N concurrent calls for one checkout exactly
     * one returns true (a JPA adapter relies on the UNIQUE {@code checkout_id} constraint).
     */
    boolean insertIfCheckoutAbsent(Order order);
}
