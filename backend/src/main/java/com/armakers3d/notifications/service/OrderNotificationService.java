package com.armakers3d.notifications.service;

import com.armakers3d.orders.service.OrderStatusChanged;
import com.armakers3d.shared.notification.EmailSender;
import com.armakers3d.users.service.CustomerDirectoryService;
import com.armakers3d.users.service.CustomerDirectoryService.ContactView;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Sends the customer email for an order status change (order-lifecycle.md section 4, D-16 PROPOSED).
 * Triggered only by {@link OrderStatusChanged} (no controller sends email). The recipient is always the
 * account that owns the order, looked up through {@link CustomerDirectoryService}; nothing from a
 * request reaches the address, subject or body. Best effort and synchronous: any failure is audited
 * (class only, no address, no body) and never propagates, so the status change is never undone. There
 * is deliberately no retry or queue (academic scope, PD-NOT-03).
 */
@Service
public class OrderNotificationService {

    private static final Logger audit = LoggerFactory.getLogger("com.armakers3d.audit.notifications");

    private final EmailSender emailSender;
    private final CustomerDirectoryService customers;
    private final String frontendBaseUrl;

    public OrderNotificationService(
            EmailSender emailSender,
            CustomerDirectoryService customers,
            @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.emailSender = emailSender;
        this.customers = customers;
        this.frontendBaseUrl = OrderEmailTemplates.requireValidBaseUrl(frontendBaseUrl);
    }

    @EventListener
    public void onOrderStatusChanged(OrderStatusChanged event) {
        if (!OrderEmailTemplates.notifies(event.newStatus())) {
            return;
        }
        try {
            Map<Long, ContactView> found = customers.contactsByIds(List.of(event.customerId()));
            ContactView customer = found.get(event.customerId());
            if (customer == null) {
                audit.warn("notification.failed order={} status={} cause=RecipientNotFound",
                        event.orderId(), event.newStatus());
                return;
            }
            var rendered = OrderEmailTemplates
                    .render(event.newStatus(), event.orderId(), customer.name(), frontendBaseUrl)
                    .orElseThrow();
            emailSender.send(customer.email(), rendered.subject(), rendered.body());
            audit.info("notification.sent order={} status={}", event.orderId(), event.newStatus());
        } catch (RuntimeException ex) {
            audit.warn("notification.failed order={} status={} cause={}",
                    event.orderId(), event.newStatus(), ex.getClass().getSimpleName());
        }
    }
}
