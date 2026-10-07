package com.armakers3d.orders.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Snapshot of one ordered product: title and unit price are copied from the catalog at order time,
 * so a later catalog change never alters the order. Money is PEN, scale 2, HALF_UP.
 */
public record OrderLine(Long productId, String title, BigDecimal unitPrice, int quantity) {

    public OrderLine {
        unitPrice = unitPrice.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal lineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
    }
}
