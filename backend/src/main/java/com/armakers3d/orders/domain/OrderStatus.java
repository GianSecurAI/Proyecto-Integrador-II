package com.armakers3d.orders.domain;

import java.util.List;

/**
 * Order status vocabulary and transition table, PROPOSED (docs/architecture/order-lifecycle.md,
 * awaiting Product Owner approval; contract review D-02). Wire values are these names (UPPER_SNAKE,
 * Spanish). The transition table below is THE single source of truth in the backend (section 3 of the
 * lifecycle doc); the same table applies to both order kinds because the doc does not distinguish them.
 */
public enum OrderStatus {
    PENDIENTE,
    CONFIRMADO,
    EN_PRODUCCION,
    ENVIADO,
    ENTREGADO,
    CANCELADO;

    /** Statuses reachable from this one, in lifecycle order. Empty for the terminal statuses. */
    public List<OrderStatus> allowedNext() {
        return switch (this) {
            case PENDIENTE -> List.of(CONFIRMADO, CANCELADO);
            case CONFIRMADO -> List.of(EN_PRODUCCION, CANCELADO);
            case EN_PRODUCCION -> List.of(ENVIADO, CANCELADO);
            case ENVIADO -> List.of(ENTREGADO);
            case ENTREGADO, CANCELADO -> List.of();
        };
    }

    public boolean canTransitionTo(OrderStatus target) {
        return target != null && allowedNext().contains(target);
    }

    public boolean isTerminal() {
        return allowedNext().isEmpty();
    }
}
