package com.armakers3d.orders.domain;

/** One requested line before validation: only product id and quantity ever come from the client. */
public record RequestedItem(Long productId, Integer quantity) {}
