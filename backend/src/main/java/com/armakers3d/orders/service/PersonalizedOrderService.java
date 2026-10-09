package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderRules;
import com.armakers3d.orders.domain.PersonalizedOrderRules;
import com.armakers3d.orders.repository.IdempotencyStore;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.exception.IdempotencyKeyReusedException;
import com.armakers3d.users.service.CustomerDirectoryService;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Registration of a PERSONALIZED order by staff (CLAUDE.md custom flow, steps 6-8): the quotation and the
 * payment happened OUTSIDE the system; this only records the result so the customer can track it. Separate
 * from the standard checkout path ({@link OrderService}). Rules in one place: validation
 * ({@link PersonalizedOrderRules}), customer resolution (D-13 through {@link CustomerDirectoryService}),
 * initial status, idempotency scoped per staff actor, audit line. No price is calculated and no payment data
 * is stored. Per D-14 the order itself is the quotation record. {@code @Transactional} arrives with a JPA adapter.
 */
@Service
public class PersonalizedOrderService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.orders");

    private final OrderRepository orders;
    private final IdempotencyStore idempotency;
    private final CustomerDirectoryService customers;
    private final OrderEventPublisher events;
    private final Clock clock;

    public PersonalizedOrderService(
            OrderRepository orders, IdempotencyStore idempotency, CustomerDirectoryService customers,
            OrderEventPublisher events, Clock clock) {
        this.events = events;
        this.orders = orders;
        this.idempotency = idempotency;
        this.customers = customers;
        this.clock = clock;
    }

    public RegisteredPersonalizedOrder register(RegisterPersonalizedOrderCommand cmd) {
        String key = IdempotencyKeys.normalize(cmd.idempotencyKey());
        var valid = PersonalizedOrderRules.validate(
                cmd.customerEmail(), cmd.description(), cmd.agreedAmount(), cmd.paymentConfirmed());

        if (key == null) {
            return result(create(cmd, valid), valid, cmd, false);
        }
        var outcome = idempotency.executeOnce(
                cmd.staffId(),
                key,
                valid.fingerprint(),
                clock.instant(),
                OrderRules.IDEMPOTENCY_TTL,
                () -> create(cmd, valid).id());
        return switch (outcome.outcome()) {
            case CREATED -> result(load(outcome.orderId()), valid, cmd, false);
            case REPLAYED -> {
                Order original = load(outcome.orderId());
                audit.info("order.personalized.replayed actor={} role={} order={}", cmd.staffId(), cmd.staffRole(), original.id());
                yield result(original, valid, cmd, true);
            }
            case MISMATCH -> {
                audit.warn("order.personalized.key_reused actor={} role={}", cmd.staffId(), cmd.staffRole());
                throw new IdempotencyKeyReusedException();
            }
        };
    }

    private Order create(RegisterPersonalizedOrderCommand cmd, PersonalizedOrderRules.Validated valid) {
        var customer = customers.findOrCreateCustomer(cmd.staffId(), valid.customerEmail());
        Order order = Order.registerPersonalized(
                orders.nextOrderNumber(), customer.id(), cmd.staffId(), cmd.staffRole(), valid.description(), valid.agreedAmount(), clock.instant());
        orders.save(order);
        // Ids only: no email, description, amount or payment attestation detail in logs.
        audit.info("order.personalized.registered actor={} role={} order={} customer={} kind={} status={}",
                cmd.staffId(), cmd.staffRole(), order.id(), order.customerId(), order.kind(), order.status());
        events.publish(new OrderStatusChanged(order.id(), order.customerId(), order.kind(), null, order.status(),
                cmd.staffId(), cmd.staffRole(), order.createdAt()));
        return order;
    }

    /**
     * RF11: creates the personalized order of an accepted quotation (the caller has verified the status and the payment
     * confirmation). The order keeps the link to the quotation; a second attempt is 409.
     */
    public Order createFromQuotation(
            Long quotationId, Long customerId, String description, java.math.BigDecimal agreedAmount, Long staffId,
            com.armakers3d.auth.domain.Rol staffRole) {
        Order order = Order.registerPersonalized(
                orders.nextOrderNumber(), customerId, staffId, staffRole, description, agreedAmount, clock.instant(),
                quotationId);
        if (!orders.insertIfQuotationAbsent(order)) {
            throw new com.armakers3d.orders.service.exception.QuotationAlreadyOrderedException();
        }
        audit.info("order.personalized.generated actor={} role={} order={} customer={} quotation={}",
                staffId, staffRole, order.id(), order.customerId(), quotationId);
        events.publish(new OrderStatusChanged(order.id(), order.customerId(), order.kind(), null, order.status(),
                staffId, staffRole, order.createdAt()));
        return order;
    }

    private Order load(String orderId) {
        return orders.findById(orderId).orElseThrow(() -> new IllegalStateException("Idempotent order vanished: " + orderId));
    }

    private static RegisteredPersonalizedOrder result(
            Order order, PersonalizedOrderRules.Validated valid, RegisterPersonalizedOrderCommand cmd, boolean replayed) {
        return new RegisteredPersonalizedOrder(order, valid.customerEmail(), cmd.staffEmail(), replayed);
    }
}
