package com.armakers3d.orders.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.InvalidStatusTransitionException;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.OrderQueryService.StaffOrderView;
import com.armakers3d.shared.error.NotFoundException;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * THE only place an order status changes (contract E26; order-lifecycle.md section 3). The transition
 * table and the history entry live in the domain ({@link Order#transitionTo}); this service loads the
 * order, applies the change, stores it with an atomic compare-and-set on the current status (so of two
 * concurrent changes exactly one wins and the loser gets 409 INVALID_STATUS_TRANSITION), audits with ids
 * only and publishes {@link OrderStatusChanged}. Who may call it (ASESOR, ADMINISTRADOR) is decided by
 * the central role matrix; the actor always comes from the authenticated principal. Re-submitting the
 * status the order already has is NOT a no-op: it is a rejected same-to-same transition (409), so a
 * retry can never append a duplicate history entry or a duplicate notification.
 * {@code @Transactional} arrives with the JPA adapter.
 */
@Service
public class OrderStatusService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.orders");

    /** Actor identity is taken from the principal by the controller, never from the body. */
    public record ChangeStatusCommand(String orderId, OrderStatus newStatus, String note, Long actorId, Rol actorRole) {}

    private final OrderRepository orders;
    private final OrderQueryService queries;
    private final OrderEventPublisher events;
    private final Clock clock;

    public OrderStatusService(
            OrderRepository orders, OrderQueryService queries, OrderEventPublisher events, Clock clock) {
        this.orders = orders;
        this.queries = queries;
        this.events = events;
        this.clock = clock;
    }

    public StaffOrderView changeStatus(ChangeStatusCommand cmd) {
        Order current = orders.findById(cmd.orderId()).orElseThrow(() -> new NotFoundException("Order not found."));
        Order updated;
        try {
            updated = current.transitionTo(cmd.newStatus(), cmd.actorId(), cmd.actorRole(), cmd.note(), clock.instant());
        } catch (InvalidStatusTransitionException ex) {
            audit.warn("order.status.rejected actor={} role={} order={} from={} to={}",
                    cmd.actorId(), cmd.actorRole(), current.id(), current.status(), cmd.newStatus());
            throw ex;
        }
        if (!orders.replaceIfStatus(updated, current.status())) {
            audit.warn("order.status.conflict actor={} role={} order={} from={} to={}",
                    cmd.actorId(), cmd.actorRole(), current.id(), current.status(), cmd.newStatus());
            throw InvalidStatusTransitionException.concurrentChange();
        }
        // Ids and statuses only: the note is never logged.
        audit.info("order.status.changed actor={} role={} order={} from={} to={}",
                cmd.actorId(), cmd.actorRole(), updated.id(), current.status(), updated.status());
        events.publish(new OrderStatusChanged(updated.id(), updated.customerId(), updated.kind(), current.status(),
                updated.status(), cmd.actorId(), cmd.actorRole(), clock.instant()));
        return queries.staffView(updated);
    }
}
