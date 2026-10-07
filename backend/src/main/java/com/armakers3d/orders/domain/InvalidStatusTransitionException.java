package com.armakers3d.orders.domain;

import com.armakers3d.shared.error.ConflictException;

/** The requested status change is not allowed from the current status (409 INVALID_STATUS_TRANSITION). */
public class InvalidStatusTransitionException extends ConflictException {

    public InvalidStatusTransitionException(OrderStatus from, OrderStatus to) {
        super("INVALID_STATUS_TRANSITION", "Cannot change the order status from " + from + " to " + to + ".");
    }

    private InvalidStatusTransitionException(String message) {
        super("INVALID_STATUS_TRANSITION", message);
    }

    /** The order changed between the read and the write (a concurrent transition won). */
    public static InvalidStatusTransitionException concurrentChange() {
        return new InvalidStatusTransitionException(
                "The order status was changed by another request; reload the order and try again.");
    }
}
