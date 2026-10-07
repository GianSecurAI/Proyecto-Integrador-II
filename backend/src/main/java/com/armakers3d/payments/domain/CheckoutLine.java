package com.armakers3d.payments.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Snapshot of one checkout line: title and unit price are copied from the catalog by the SERVER when the checkout
 * is created, so neither the client nor a later catalog change can alter what is charged. PEN, scale 2, HALF_UP.
 */
public record CheckoutLine(Long productId, String title, BigDecimal unitPrice, int quantity) {

    public CheckoutLine {
        unitPrice = unitPrice.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal lineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
    }
}
