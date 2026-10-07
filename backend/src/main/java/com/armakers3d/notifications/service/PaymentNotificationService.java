package com.armakers3d.notifications.service;

import com.armakers3d.payments.service.PaymentProofRejected;
import com.armakers3d.shared.notification.EmailSender;
import com.armakers3d.users.service.CustomerDirectoryService;
import com.armakers3d.users.service.CustomerDirectoryService.ContactView;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Sends the customer email when an administrator rejects a payment proof (ADR-005). Triggered only by
 * {@link PaymentProofRejected}; the recipient is always the checkout owner's account. Best effort: any failure is
 * audited (class only, no address, no body) and never propagates, so the rejection is never undone. The email for an
 * APPROVED payment is the CONFIRMADO order email sent by {@link OrderNotificationService}.
 */
@Service
public class PaymentNotificationService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.notifications");

    private final EmailSender emailSender;
    private final CustomerDirectoryService customers;
    private final String frontendBaseUrl;

    public PaymentNotificationService(
            EmailSender emailSender, CustomerDirectoryService customers,
            @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.emailSender = emailSender;
        this.customers = customers;
        this.frontendBaseUrl = OrderEmailTemplates.requireValidBaseUrl(frontendBaseUrl);
    }

    @EventListener
    public void onProofRejected(PaymentProofRejected event) {
        String shortId = event.checkoutId() == null ? "-" : event.checkoutId().substring(0, Math.min(8, event.checkoutId().length()));
        try {
            ContactView customer = customers.contactsByIds(List.of(event.customerId())).get(event.customerId());
            if (customer == null) {
                audit.warn("notification.failed payment.rejected checkout={} cause=RecipientNotFound", shortId);
                return;
            }
            var rendered = PaymentEmailTemplates.proofRejected(
                    customer.name(), event.reason(), event.checkoutId(), frontendBaseUrl);
            emailSender.send(customer.email(), rendered.subject(), rendered.body());
            audit.info("notification.sent payment.rejected checkout={}", shortId);
        } catch (RuntimeException ex) {
            audit.warn("notification.failed payment.rejected checkout={} cause={}", shortId, ex.getClass().getSimpleName());
        }
    }
}
