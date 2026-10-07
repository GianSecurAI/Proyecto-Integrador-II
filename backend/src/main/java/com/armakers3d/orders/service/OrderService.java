package com.armakers3d.orders.service;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.catalog.service.CatalogService;
import com.armakers3d.catalog.service.CatalogService.OrderableProduct;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderRules;
import com.armakers3d.orders.domain.RequestedItem;
import com.armakers3d.orders.domain.ValidatedOrder;
import com.armakers3d.orders.repository.IdempotencyStore;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.exception.IdempotencyKeyReusedException;
import com.armakers3d.orders.service.exception.ProductUnavailableException;
import com.armakers3d.shared.error.ApiError;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orders use cases. Today: submission of a STANDARD catalog order (CLAUDE.md flow steps 1-3 and 5,
 * WITHOUT the payment step, PD-ORD-01). The service is the single place where the rules live:
 * validation (via {@link OrderRules}), authoritative product lookup through the catalog service,
 * price snapshot, totals, initial status, idempotency and the audit line. Transaction boundary:
 * {@code @Transactional} is added together with the JPA adapter (in-memory has none), like the other
 * in-memory features.
 */
@Service
public class OrderService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.orders");

    private final OrderRepository orders;
    private final IdempotencyStore idempotency;
    private final CatalogService catalog;
    private final OrderEventPublisher events;
    private final Clock clock;

    public OrderService(
            OrderRepository orders, IdempotencyStore idempotency, CatalogService catalog, OrderEventPublisher events,
            Clock clock) {
        this.events = events;
        this.orders = orders;
        this.idempotency = idempotency;
        this.catalog = catalog;
        this.clock = clock;
    }

    public PlacedOrder placeStandardOrder(PlaceOrderCommand command) {
        String key = IdempotencyKeys.normalize(command.idempotencyKey());
        ValidatedOrder validated = OrderRules.validate(command.items(), command.delivery(), command.contact());

        if (key == null) {
            return new PlacedOrder(create(command.customerId(), validated), false);
        }
        var result = idempotency.executeOnce(
                command.customerId(),
                key,
                validated.fingerprint(),
                clock.instant(),
                OrderRules.IDEMPOTENCY_TTL,
                () -> create(command.customerId(), validated).id());
        return switch (result.outcome()) {
            case CREATED -> new PlacedOrder(load(result.orderId()), false);
            case REPLAYED -> {
                Order original = load(result.orderId());
                audit.info("order.create.replayed actor={} order={}", command.customerId(), original.id());
                yield new PlacedOrder(original, true);
            }
            case MISMATCH -> {
                audit.warn("order.create.key_reused actor={}", command.customerId());
                throw new IdempotencyKeyReusedException();
            }
        };
    }

    private Order load(String orderId) {
        return orders.findById(orderId).orElseThrow(() -> new IllegalStateException("Idempotent order vanished: " + orderId));
    }

    /** Resolves authoritative products, snapshots them, computes the totals and stores the order. */
    private Order create(Long customerId, ValidatedOrder validated) {
        List<OrderLine> lines = new ArrayList<>();
        List<ApiError.FieldError> unavailable = new ArrayList<>();
        List<RequestedItem> items = validated.items();
        for (int i = 0; i < items.size(); i++) {
            RequestedItem item = items.get(i);
            var product = catalog.findOrderable(item.productId());
            if (product.isEmpty()) {
                unavailable.add(new ApiError.FieldError("items[" + i + "].productId", "product is not available"));
            } else {
                OrderableProduct p = product.get();
                lines.add(new OrderLine(p.id(), p.title(), p.unitPrice(), item.quantity()));
            }
        }
        if (!unavailable.isEmpty()) {
            throw new ProductUnavailableException(unavailable);
        }
        Order order = Order.placeStandard(
                orders.nextOrderNumber(), customerId, lines, validated.delivery(), validated.contact(), clock.instant());
        orders.save(order);
        // Ids and counts only: no name, phone, address or notes in logs.
        audit.info("order.created actor={} order={} kind={} status={} lines={} units={}",
                customerId, order.id(), order.kind(), order.status(), order.lines().size(), order.totalUnits());
        events.publish(new OrderStatusChanged(order.id(), order.customerId(), order.kind(), null, order.status(),
                customerId, Rol.CLIENTE, order.createdAt()));
        return order;
    }
}
