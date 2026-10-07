/**
 * Notifications domain (stage 11): customer email on order status changes (order-lifecycle.md section 4).
 * Driven only by the in-process {@code OrderStatusChanged} event; no controller, no broker, no stored
 * history. Sends through the single {@code shared.notification.EmailSender} port. May depend on
 * {@code shared}, {@code orders.service} (event type) and {@code users.service} (recipient lookup).
 */
package com.armakers3d.notifications;
