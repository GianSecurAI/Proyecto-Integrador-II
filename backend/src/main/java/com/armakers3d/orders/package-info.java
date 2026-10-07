/**
 * Orders domain. Implemented: submission of standard catalog orders (POST /api/orders, no payment step yet,
 * PD-ORD-01). Staff registration of personalized orders after external
 * quotation and payment (POST /api/admin/orders/personalized, PD-ORD-09..12). Planned (Stage 10): history/tracking and status
 * transitions per docs/architecture/order-lifecycle.md. There is deliberately no
 * separate quotations module (docs/architecture/backend-foundation.md). Depends on {@code catalog} (through its
 * service only), {@code auth.security} (principal) and {@code shared}.
 */
package com.armakers3d.orders;
