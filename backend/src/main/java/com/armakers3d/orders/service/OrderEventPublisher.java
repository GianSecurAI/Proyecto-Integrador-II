package com.armakers3d.orders.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Single place that publishes {@link OrderStatusChanged}. Best effort by design (order-lifecycle.md
 * section 4: delivery never blocks a transition): a failing listener is logged (class only, no
 * payload) and swallowed, because the order change is already stored.
 */
@Component
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final ApplicationEventPublisher publisher;

    public OrderEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(OrderStatusChanged event) {
        try {
            publisher.publishEvent(event);
        } catch (RuntimeException ex) {
            log.warn("order.status.listener_failed order={} cause={}", event.orderId(), ex.getClass().getSimpleName());
        }
    }
}
