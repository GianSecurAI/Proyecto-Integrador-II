package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.RequestedItem;
import java.util.List;

/**
 * Use-case input for placing a standard order. {@code customerId} is the authenticated principal id,
 * never a request field. {@code idempotencyKey} is null when the client sent none. There is no price,
 * total or status here by construction.
 */
public record PlaceOrderCommand(
        Long customerId,
        String idempotencyKey,
        List<RequestedItem> items,
        DeliveryInfo delivery,
        ContactInfo contact) {}
