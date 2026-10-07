package com.armakers3d.orders.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.repository.OrderRepository;
import java.time.Clock;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Creation of STANDARD catalog orders (CLAUDE.md standard flow, step 5): an order exists only as the result of a
 * payment VERIFIED BY AN ADMINISTRATOR, never from a customer request (ADR-005). The caller (the payments module) has already
 * validated the checkout and holds the price snapshot; this service only turns that
 * snapshot into the order, idempotently per checkout (the unique {@code checkout_id} makes a second creation for
 * the same checkout impossible even under concurrent approvals). {@code orders} does not know the
 * payments module: the command carries plain order types and an opaque checkout id.
 * {@code @Transactional} arrives with the JPA adapter (in-memory has none).
 */
@Service
public class OrderService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.orders");

    /**
     * Use-case input. {@code lines} are the server-side snapshot stored with the checkout (title and unit price
     * at checkout time); {@code paymentReference} is the checkout payment reference (staff-only); {@code actorId}/{@code actorRole} the approving administrator (history actor).
     */
    public record PlaceFromCheckoutCommand(
            String checkoutId,
            Long customerId,
            List<OrderLine> lines,
            DeliveryInfo delivery,
            ContactInfo contact,
            String paymentReference,
            Long actorId,
            Rol actorRole) {}

    /** {@code created} is false when the order already existed for that checkout (a replay): nothing was published. */
    public record PlacedFromCheckout(Order order, boolean created) {}

    private final OrderRepository orders;
    private final OrderEventPublisher events;
    private final Clock clock;

    public OrderService(OrderRepository orders, OrderEventPublisher events, Clock clock) {
        this.orders = orders;
        this.events = events;
        this.clock = clock;
    }

    public PlacedFromCheckout placeStandardOrderFromCheckout(PlaceFromCheckoutCommand cmd) {
        var existing = orders.findByCheckoutId(cmd.checkoutId());
        if (existing.isPresent()) {
            return new PlacedFromCheckout(existing.get(), false);
        }
        Order order = Order.placeFromCheckout(
                orders.nextOrderNumber(), cmd.customerId(), cmd.checkoutId(), cmd.paymentReference(), cmd.lines(),
                cmd.delivery(), cmd.contact(), cmd.actorId(), cmd.actorRole(), clock.instant());
        if (!orders.insertIfCheckoutAbsent(order)) {
            // Lost a race with a concurrent confirmation of the same checkout: the winner publishes.
            return new PlacedFromCheckout(orders.findByCheckoutId(cmd.checkoutId()).orElseThrow(), false);
        }
        // Ids and counts only: no name, phone, address, notes, amount or payment reference in logs.
        audit.info("order.created actor={} order={} customer={} kind={} status={} lines={} units={}",
                cmd.actorId(), order.id(), order.customerId(), order.kind(), order.status(), order.lines().size(), order.totalUnits());
        events.publish(new OrderStatusChanged(order.id(), order.customerId(), order.kind(), null, order.status(),
                cmd.actorId(), cmd.actorRole(), order.createdAt()));
        return new PlacedFromCheckout(order, true);
    }
}
