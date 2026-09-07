import {
  OrderDetailViewModel,
  OrderStatus,
  OrderSummaryViewModel,
} from '../../account/models/order.model';

/**
 * Staff-scoped order ViewModels for RF-13 ("Gestión de los estados del pedido", actor
 * Administrador/Asesor — `docs/discovery/06-system-definition.md` line 62) and RF-11 ("Registro
 * de pedidos", actor Asesor/Administrador, "Confirmado para el flujo personalizado" — line 60).
 *
 * These deliberately EXTEND (never fork) the one approved order vocabulary already established
 * by `features/account/models/order.model.ts` (`OrderStatus`, `OrderKind`, `describeOrderStatus`,
 * `OrderSummaryViewModel`, `OrderDetailViewModel`) — that file's own "ASSUMPTION" disclaimer about
 * the status vocabulary applies equally here; nothing in this file is an approved state machine
 * either, it only adds what a STAFF screen additionally needs to know that a customer's own
 * "my orders" screen never needs: which customer an order belongs to.
 *
 * `customerEmail` is always present (an order is always attributed to some registered customer).
 * `customerName`/`customerPhone` are OPTIONAL — the same "optional profile field, may be absent"
 * decision already established by `RegisterPage`'s `firstName`/`lastName`/`phone` fields
 * (`features/auth/pages/register/register.page.ts`) — a staff screen must degrade gracefully
 * (render only what is present) rather than assume every customer filled them in.
 */
export interface AdminOrderSummaryViewModel extends OrderSummaryViewModel {
  readonly customerEmail: string;
  readonly customerName?: string;
  readonly customerPhone?: string;
}

/** Staff detail ViewModel — adds the append-only status-history timeline, same relationship
 * `OrderDetailViewModel` already has to `OrderSummaryViewModel`. */
export interface AdminOrderViewModel extends OrderDetailViewModel {
  readonly customerEmail: string;
  readonly customerName?: string;
  readonly customerPhone?: string;
}

/**
 * ASSUMPTION — order status transition map (not final, pending a real `docs/architecture/order-
 * lifecycle.md`, which does not exist yet — confirmed absent at the time this map was written).
 * RF-13 is "Confirmado" as a requirement but its status catalog/transition rules are explicitly
 * undefined ("Confirmado (catálogo de estados pendiente)"). This is a small, genuine constraint
 * (not every status reachable from every other) invented only so this frontend-only preview has
 * something testable to render and so the status-transition control never offers an arbitrary
 * free choice of all six values. A future real RF-13 spec may redefine these edges entirely;
 * nothing here is an approved state machine, and no component evaluates a transition *decision*
 * beyond "is this edge present in this map" — that remains presentation/defense-in-depth, never a
 * business rule invented client-side (Constitution Prohibited Practice #5). `entregado` and
 * `cancelado` are terminal (no outgoing edges).
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_produccion', 'cancelado'],
  en_produccion: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};

/** The only next-states a status-transition control may ever offer for a given current status —
 * used by both the detail page (to populate the `<select>`) and the mock service (defense in
 * depth: rejects an attempted transition outside this list even though the UI never offers one). */
export function getAllowedNextStatuses(current: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[current];
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Local, form-only model for the "registrar pedido personalizado" screen — deliberately NOT an
 * `AdminOrderViewModel`/`Cotizacion` persistence model, same "form model independent from view/
 * persistence model" discipline already established by `ProductFormValue`/`RegisterFormValue`/
 * `NewIncidentFormValue`.
 *
 * Field grounding (`docs/discovery/06-system-definition.md`):
 * - `customerEmail`: identifies the (already-registered) customer the advisor is registering this
 *   order for — RF-11's actor is Asesor/Administrador, registering on behalf of a customer who
 *   coordinated over WhatsApp, not the customer themself.
 * - `quotationDescription`/`quotationAmount`: the `Cotizacion` entity (line 140 — "Cliente/
 *   contacto, descripción, monto acordado manualmente, asesor responsable, fecha, estado").
 *   `quotationAmount` is always a plain, manually-typed positive number — line 96: "El sistema no
 *   calcula automáticamente el precio de impresión personalizada — el monto de una `Cotización`
 *   siempre es un dato manual del asesor." Nothing here derives or computes this value from
 *   anything else in the form.
 * - `paymentConfirmed`: the required attestation checkbox grounded by line 95 — "Un pedido
 *   personalizado no se registra en el sistema hasta que el pago externo fue confirmado por el
 *   asesor (el sistema confía en la afirmación humana, no valida el pago)." This is deliberately a
 *   boolean checkbox, never a payment field/form/gateway call of any kind (CLAUDE.md's "Business
 *   clarification: purchasing flows" — the custom flow's payment stays entirely external).
 *
 * There is no general free-text "order notes" field here — the approved `Pedido` entity (line
 * 141) has none; the only approved note-like field is `HistorialEstadoPedido.nota` (line 142), a
 * note on a specific status-transition action, already modeled by
 * `OrderStatusHistoryEntryViewModel.note` and used on the detail page's transition control, not
 * duplicated here.
 */
export interface RegisterPersonalizedOrderFormValue {
  readonly customerEmail: string;
  readonly quotationDescription: string;
  readonly quotationAmount: number;
  readonly paymentConfirmed: boolean;
}

export const EMPTY_REGISTER_PERSONALIZED_ORDER_FORM_VALUE: RegisterPersonalizedOrderFormValue = {
  customerEmail: '',
  quotationDescription: '',
  quotationAmount: 0,
  paymentConfirmed: false,
};
