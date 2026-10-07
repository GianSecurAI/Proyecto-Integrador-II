/**
 * Orders domain. Standard catalog orders are created ONLY from a confirmed payment
 * ({@code OrderService.placeStandardOrderFromCheckout}, called by the payments module; BE-09), then read by the
 * owner (GET /api/orders, /api/orders/{id}) and managed by staff (list, detail with paymentReference, status
 * changes per docs/architecture/order-lifecycle.md). Staff register personalized orders after external quotation
 * and payment (POST /api/admin/orders/personalized, PD-ORD-09..12). The interim customer-facing POST /api/orders
 * was removed (BE-10). There is deliberately no separate quotations module (docs/architecture/backend-foundation.md).
 * Depends on {@code auth.security} (principal), {@code users} (directory) and {@code shared}; it does NOT depend on
 * {@code payments} (it only stores an opaque checkout id and payment reference).
 */
package com.armakers3d.orders;
