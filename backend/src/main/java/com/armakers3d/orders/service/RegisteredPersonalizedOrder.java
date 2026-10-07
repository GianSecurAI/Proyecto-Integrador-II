package com.armakers3d.orders.service;

import com.armakers3d.orders.domain.Order;

/** Result: the order, the owner's (normalized) email, the staff email and whether it replays an earlier registration. */
public record RegisteredPersonalizedOrder(Order order, String customerEmail, String staffEmail, boolean replayed) {}
