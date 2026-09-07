/**
 * ASSUMPTION — order status vocabulary (not final, pending Product Owner confirmation).
 *
 * RF-13 ("Gestión de los estados del pedido") is "Confirmado" as a requirement but explicitly
 * leaves its status catalog undefined — docs/discovery/06-system-definition.md line 62:
 * "Confirmado (catálogo de estados pendiente)". The six values below are a placeholder
 * vocabulary, invented only so this frontend-only preview screen and its mock fixtures
 * (`../mocks/customer-orders.mock.ts`) have something testable to render. This mirrors the exact
 * disclaimer pattern already used for OTP policy defaults in
 * `specs/001-customer-otp-auth/spec.md`'s "Assumptions" section ("these values are assumptions
 * for the purpose of writing testable acceptance criteria and are not final"). A future real
 * RF-13 spec may rename, reorder, add, or remove states; nothing here is an approved state
 * machine, and no component in this feature evaluates a status *transition* rule — that decision
 * belongs entirely to a future backend (Constitution Prohibited Practice #5).
 */
export type OrderStatus =
  | 'pendiente'
  | 'confirmado'
  | 'en_produccion'
  | 'enviado'
  | 'entregado'
  | 'cancelado';

/**
 * Standard vs. personalized is derived, never stored as its own flag — see
 * `../mocks/customer-orders.mock.ts`'s field-provenance comment: an order is "personalizado" iff
 * it carries an (optional, mock) reference to a `Cotizacion`
 * (docs/discovery/06-system-definition.md line 158: "Cotizacion 0..1---1 Pedido"), matching
 * CLAUDE.md's "Business clarification: purchasing flows" section (standard catalog =
 * self-service checkout; custom = advisor-mediated via WhatsApp, quoted manually, then
 * advisor-registered).
 */
export type OrderKind = 'estandar' | 'personalizado';

/**
 * UI ViewModel for the order-history list (RF-05/RF-12) — NOT a persistence/DTO assumption, same
 * "ViewModel vs. persistence assumption" separation already established by
 * `customer-profile.model.ts`. Deliberately kept distinct from the mock's raw seed shape
 * (`../mocks/customer-orders.mock.ts` — `CustomerOrderSeed`, which stores ISO date strings and a
 * `history` array instead of a resolved `status`) and from any hypothetical backend DTO (no
 * `Pedido` entity exists in `backend/src` at all yet).
 *
 * `summary` is a plain short string, not an itemized line-item breakdown — line 147 of
 * 06-system-definition.md explicitly defers `PedidoItem` ("línea de pedido multi-producto") as
 * not modeled yet, so this screen must not invent one either.
 */
export interface OrderSummaryViewModel {
  readonly id: string;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  readonly kind: OrderKind;
  readonly summary: string;
}

/**
 * One append-only entry of `HistorialEstadoPedido`
 * (docs/discovery/06-system-definition.md line 142: "Pedido, estado anterior, estado nuevo,
 * fecha, responsable, nota — append-only"). `previousStatus` is `null` only for the very first
 * entry (order creation has no "previous" state).
 */
export interface OrderStatusHistoryEntryViewModel {
  readonly previousStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedAt: Date;
  readonly responsible: string;
  readonly note: string | null;
}

/**
 * UI ViewModel for the order-detail screen (RF-05/RF-12/RF-14) — adds the append-only
 * status-history timeline to `OrderSummaryViewModel`. The order's current `status` is always
 * `statusHistory[statusHistory.length - 1].newStatus` (see the mock service's mapping) — there is
 * deliberately no separate, independently-settable "current status" field on this ViewModel, to
 * avoid two values that could disagree.
 */
export interface OrderDetailViewModel extends OrderSummaryViewModel {
  readonly statusHistory: readonly OrderStatusHistoryEntryViewModel[];
}

/** Semantic visual treatment for `shared/ui/status-badge` — kept generic (not order-specific) so
 * a future incidents/quotations screen (both also carry an `estado` field per
 * docs/discovery/06-system-definition.md lines 143-144) can reuse the same badge shell with its
 * own vocabulary. */
export type OrderStatusBadgeTone = 'neutral' | 'info' | 'success' | 'danger';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_produccion: 'En producción',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const ORDER_STATUS_TONES: Record<OrderStatus, OrderStatusBadgeTone> = {
  pendiente: 'neutral',
  confirmado: 'info',
  en_produccion: 'info',
  enviado: 'info',
  entregado: 'success',
  cancelado: 'danger',
};

/** Pure label+tone mapping — no business decision, purely a presentation lookup. Used by
 * `../components/order-status-badge/order-status-badge.component.ts`. */
export function describeOrderStatus(status: OrderStatus): {
  label: string;
  tone: OrderStatusBadgeTone;
} {
  return { label: ORDER_STATUS_LABELS[status], tone: ORDER_STATUS_TONES[status] };
}
