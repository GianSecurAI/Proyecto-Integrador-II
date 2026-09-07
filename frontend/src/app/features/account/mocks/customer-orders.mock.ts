import { OrderStatus } from '../models/order.model';

/**
 * Isolated seed fixtures for the RF-05 ("Consulta de historial de pedidos"), RF-12 ("Consulta y
 * seguimiento del estado del pedido") and RF-14 ("Historial de cambios de estado del pedido")
 * preview screens — all three "Confirmado" in docs/discovery/06-system-definition.md (lines 54,
 * 61, 63). No `Pedido`/`HistorialEstadoPedido` backend entity exists yet (`backend/src` has zero
 * matches for either) and no REST contract is defined — this fixture,
 * `../services/customer-orders-mock.service.ts`, and both order pages are entirely
 * frontend-only, mirroring the isolation pattern already used by
 * `features/catalog/mocks/product-details.mock.ts` and
 * `features/account/mocks/customer-profile.mock.ts`.
 *
 * Field provenance (Constitution Principle I traceability):
 * - `id` / `placedAtIso`: the `Pedido` entity per 06-system-definition.md line 141 ("Cliente,
 *   referencia opcional a Cotizacion, estado actual, fecha").
 * - `quotationReference`: that same line's "referencia opcional a Cotizacion" — its mere
 *   *presence* (not a separate boolean field) is what `toKind()` in the mock service uses to
 *   distinguish a personalized order from a standard catalog order, per line 158 ("Cotizacion
 *   0..1---1 Pedido: una cotización pagada se convierte en, como máximo, un pedido") and
 *   CLAUDE.md's "Business clarification: purchasing flows" section.
 * - `history`: `HistorialEstadoPedido` per line 142 ("Pedido, estado anterior, estado nuevo,
 *   fecha, responsable, nota — append-only"). The order's current status is always the *last*
 *   entry's `newStatus` — there is deliberately no separate "current status" field here, to avoid
 *   two values that could disagree.
 * - `summary`: a plain short string, NOT an itemized line-item breakdown — line 147 explicitly
 *   defers `PedidoItem` ("línea de pedido multi-producto") as not modeled yet.
 *
 * See `../models/order.model.ts`'s doc comment on `OrderStatus` for the full ASSUMPTION
 * disclaimer about the status vocabulary used below (`pendiente`, `confirmado`,
 * `en_produccion`, `enviado`, `entregado`, `cancelado`) — it is a placeholder, not an approved
 * RF-13 state machine.
 */
export interface CustomerOrderStatusHistorySeed {
  readonly previousStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedAtIso: string; // ISO 8601
  readonly responsible: string;
  readonly note: string | null;
}

export interface CustomerOrderSeed {
  readonly id: string;
  readonly placedAtIso: string; // ISO 8601
  /** Optional reference to a `Cotizacion` — presence alone marks this order "personalizado". */
  readonly quotationReference: string | null;
  readonly summary: string;
  /** Append-only, chronological. Must have at least one entry; the last entry's `newStatus` is
   * the order's current status. */
  readonly history: readonly CustomerOrderStatusHistorySeed[];
}

export const CUSTOMER_ORDERS_SEED: readonly CustomerOrderSeed[] = [
  {
    id: 'PED-2031',
    placedAtIso: '2026-06-02T15:04:00Z',
    quotationReference: null,
    summary: 'Set de 3 llaveros personalizados con silueta de mascota',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-06-02T15:04:00Z',
        responsible: 'Sistema',
        note: 'Pedido registrado tras el pago en línea.',
      },
      {
        previousStatus: 'pendiente',
        newStatus: 'confirmado',
        changedAtIso: '2026-06-02T16:30:00Z',
        responsible: 'Sistema',
        note: 'Pago confirmado por la pasarela de pagos.',
      },
      {
        previousStatus: 'confirmado',
        newStatus: 'en_produccion',
        changedAtIso: '2026-06-03T09:15:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: 'Impresión iniciada en la cola de producción.',
      },
      {
        previousStatus: 'en_produccion',
        newStatus: 'enviado',
        changedAtIso: '2026-06-05T18:20:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: 'Entregado a la empresa de courier.',
      },
      {
        previousStatus: 'enviado',
        newStatus: 'entregado',
        changedAtIso: '2026-06-07T14:45:00Z',
        responsible: 'Sistema',
        note: 'Confirmación de entrega recibida del courier.',
      },
    ],
  },
  {
    id: 'PED-2044',
    placedAtIso: '2026-07-11T11:00:00Z',
    quotationReference: 'COT-0117',
    summary: 'Figura personalizada a escala, cotizada por WhatsApp',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-07-11T11:00:00Z',
        responsible: 'María Torres (Asesor)',
        note: 'Pedido registrado tras confirmar el pago externo de la cotización COT-0117.',
      },
      {
        previousStatus: 'pendiente',
        newStatus: 'confirmado',
        changedAtIso: '2026-07-11T17:40:00Z',
        responsible: 'María Torres (Asesor)',
        note: null,
      },
      {
        previousStatus: 'confirmado',
        newStatus: 'en_produccion',
        changedAtIso: '2026-07-13T08:00:00Z',
        responsible: 'María Torres (Asesor)',
        note: 'Modelado 3D en curso.',
      },
    ],
  },
  {
    id: 'PED-2050',
    placedAtIso: '2026-08-20T09:30:00Z',
    quotationReference: null,
    summary: 'Organizador de escritorio modular (2 unidades)',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-08-20T09:30:00Z',
        responsible: 'Sistema',
        note: 'Pedido registrado tras el pago en línea.',
      },
    ],
  },
  {
    id: 'PED-2012',
    placedAtIso: '2026-04-18T13:15:00Z',
    quotationReference: null,
    summary: 'Maceta geométrica mediana, color negro',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-04-18T13:15:00Z',
        responsible: 'Sistema',
        note: 'Pedido registrado tras el pago en línea.',
      },
      {
        previousStatus: 'pendiente',
        newStatus: 'confirmado',
        changedAtIso: '2026-04-18T14:00:00Z',
        responsible: 'Sistema',
        note: null,
      },
      {
        previousStatus: 'confirmado',
        newStatus: 'cancelado',
        changedAtIso: '2026-04-19T10:05:00Z',
        responsible: 'Ana Quispe (Asesor)',
        note: 'Cancelado a solicitud del cliente antes de iniciar producción.',
      },
    ],
  },
  {
    id: 'PED-2061',
    placedAtIso: '2026-08-30T16:50:00Z',
    quotationReference: 'COT-0132',
    summary: 'Réplica personalizada de trofeo, cotizada por WhatsApp',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-08-30T16:50:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: 'Pedido registrado tras confirmar el pago externo de la cotización COT-0132.',
      },
      {
        previousStatus: 'pendiente',
        newStatus: 'confirmado',
        changedAtIso: '2026-08-31T09:00:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: null,
      },
      {
        previousStatus: 'confirmado',
        newStatus: 'en_produccion',
        changedAtIso: '2026-09-01T09:00:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: null,
      },
      {
        previousStatus: 'en_produccion',
        newStatus: 'enviado',
        changedAtIso: '2026-09-04T12:30:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: 'Entregado a la empresa de courier.',
      },
    ],
  },
];

/** Explicit empty fixture — used by the mock service's `?mockState=empty` preview path so the
 * order-history page's "no orders yet" state can be exercised deterministically without a real
 * customer with zero orders. */
export const CUSTOMER_ORDERS_EMPTY: readonly CustomerOrderSeed[] = [];
