package com.armakers3d.orders.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

/**
 * A checkout request that passed {@link OrderRules#validate}: trimmed, in range, no duplicate
 * products. {@link #fingerprint()} identifies its content for idempotency (same content, same
 * fingerprint, whatever the line order).
 */
public record ValidatedOrder(List<RequestedItem> items, DeliveryInfo delivery, ContactInfo contact) {

    public ValidatedOrder {
        items = List.copyOf(items);
    }

    public String fingerprint() {
        StringBuilder canonical = new StringBuilder();
        items.stream()
                .sorted(Comparator.comparing(RequestedItem::productId))
                .forEach(i -> canonical.append(i.productId()).append('x').append(i.quantity()).append(';'));
        for (String part : new String[] {
            delivery.address(), delivery.district(), delivery.notes() == null ? "" : delivery.notes(),
            contact.fullName(), contact.phone()
        }) {
            // Length prefix: two different field splits of the same text can never collide.
            canonical.append('|').append(part.length()).append(':').append(part);
        }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }
}
