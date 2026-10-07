package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;

/** Result of {@code OrderService.placeStandardOrder}: the order and whether it is a replay of an earlier submission. */
public record PlacedOrder(Order order, boolean replayed) {}
