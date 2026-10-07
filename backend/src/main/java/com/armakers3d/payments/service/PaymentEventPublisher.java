package com.armakers3d.payments.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Single place that publishes payment events. Best effort by design: a failing listener is logged (class only, no
 * payload) and swallowed, because the transition is already stored and must never be undone by an email problem.
 */
@Component
public class PaymentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventPublisher.class);

    private final ApplicationEventPublisher publisher;

    public PaymentEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(PaymentProofRejected event) {
        try {
            publisher.publishEvent(event);
        } catch (RuntimeException ex) {
            log.warn("payment.event.listener_failed checkout={} cause={}", LogMasks.checkout(event.checkoutId()),
                    ex.getClass().getSimpleName());
        }
    }
}
