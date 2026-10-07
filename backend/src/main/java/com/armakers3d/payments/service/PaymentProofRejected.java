package com.armakers3d.payments.service;

import java.time.Instant;

/**
 * In-process hook published AFTER an administrator rejected a payment proof (the notifications module sends the
 * customer email from it; payments knows nothing about email). {@code reason} is the administrator's text, already
 * validated; the listener sanitizes and length-caps it again before it goes into an email. No email address, name or
 * amount travels in it. Listener failures never affect the rejection (see {@link PaymentEventPublisher}).
 */
public record PaymentProofRejected(String checkoutId, Long customerId, String reason, Instant occurredAt) {}
