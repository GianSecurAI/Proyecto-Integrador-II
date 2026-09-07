import { OrderStatus } from '../../account/models/order.model';

/**
 * Isolated, staff-scoped seed fixtures for the RF-13/RF-11 admin order screens
 * (`pages/order-list/`, `pages/order-detail/`, `pages/register-personalized-order/`). Distinct
 * from `features/account/mocks/customer-orders.mock.ts` (which represents "the current
 * customer's own orders") — this fixture spans MULTIPLE different customers, since a staff
 * screen must see every customer's orders, mirroring the "isolated, frontend-only preview
 * fixture" pattern already used everywhere else in this codebase (no `Pedido`/`Cotizacion`
 * backend entity exists yet, no REST contract is defined).
 *
 * Same field provenance as `customer-orders.mock.ts`'s doc comment: `quotationReference`'s mere
 * presence marks an order "personalizado" (docs/discovery/06-system-definition.md line 158);
 * `history`'s last entry's `newStatus` is always the order's current status.
 *
 * Deliberately includes:
 * - four distinct customer emails, so the staff list/filter genuinely spans customers.
 * - a mix of `estandar`/`personalizado` orders.
 * - a mix of statuses across the ASSUMPTION lifecycle (`../models/admin-order.model.ts`),
 *   including at least one `cancelado`.
 * - customers with a full name + phone, a name only, and neither — exercising the "optional,
 *   may be absent" degrade-gracefully requirement for `customerName`/`customerPhone`.
 */
export interface AdminOrderStatusHistorySeed {
  readonly previousStatus: OrderStatus | null;
  readonly newStatus: OrderStatus;
  readonly changedAtIso: string; // ISO 8601
  readonly responsible: string;
  readonly note: string | null;
}

export interface AdminOrderSeed {
  readonly id: string;
  readonly placedAtIso: string; // ISO 8601
  readonly customerEmail: string;
  readonly customerName?: string;
  readonly customerPhone?: string;
  /** Optional reference to a `Cotizacion` — presence alone marks this order "personalizado". */
  readonly quotationReference: string | null;
  readonly summary: string;
  /** Append-only, chronological. Must have at least one entry. */
  readonly history: readonly AdminOrderStatusHistorySeed[];
}

export const ADMIN_ORDERS_SEED: readonly AdminOrderSeed[] = [
  {
    id: 'PED-3001',
    placedAtIso: '2026-06-02T15:04:00Z',
    customerEmail: 'ana.rojas@example.com',
    customerName: 'Ana Rojas',
    customerPhone: '+51 987 654 321',
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
    id: 'PED-3002',
    placedAtIso: '2026-07-11T11:00:00Z',
    customerEmail: 'ana.rojas@example.com',
    customerName: 'Ana Rojas',
    customerPhone: '+51 987 654 321',
    quotationReference: 'COT-0117',
    summary: 'Figura personalizada a escala, cotizada por WhatsApp',
    history: [
      {
        previousStatus: null,
        newStatus: 'confirmado',
        changedAtIso: '2026-07-11T11:00:00Z',
        responsible: 'María Torres (Asesor)',
        note: 'Pedido registrado tras confirmar el pago externo de la cotización COT-0117.',
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
    id: 'PED-3003',
    placedAtIso: '2026-08-20T09:30:00Z',
    customerEmail: 'carlos.mendez@example.com',
    customerName: 'Carlos Méndez',
    // No phone on file — exercises the "name present, phone absent" degrade-gracefully case.
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
    id: 'PED-3004',
    placedAtIso: '2026-04-18T13:15:00Z',
    customerEmail: 'maria.lopez@example.com',
    customerName: 'María López',
    customerPhone: '+51 912 345 678',
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
    id: 'PED-3005',
    placedAtIso: '2026-08-30T16:50:00Z',
    // Neither name nor phone on file — exercises the "only email known" degrade-gracefully case.
    customerEmail: 'diego.torres@example.com',
    quotationReference: 'COT-0132',
    summary: 'Réplica personalizada de trofeo, cotizada por WhatsApp',
    history: [
      {
        previousStatus: null,
        newStatus: 'confirmado',
        changedAtIso: '2026-08-30T16:50:00Z',
        responsible: 'Luis Farfán (Asesor)',
        note: 'Pedido registrado tras confirmar el pago externo de la cotización COT-0132.',
      },
    ],
  },
  {
    id: 'PED-3006',
    placedAtIso: '2026-09-04T12:30:00Z',
    customerEmail: 'jorge.diaz@example.com',
    customerName: 'Jorge Díaz',
    customerPhone: '+51 998 112 233',
    quotationReference: null,
    summary: 'Pack de 5 pegatinas personalizadas',
    history: [
      {
        previousStatus: null,
        newStatus: 'pendiente',
        changedAtIso: '2026-09-04T12:30:00Z',
        responsible: 'Sistema',
        note: 'Pedido registrado tras el pago en línea.',
      },
      {
        previousStatus: 'pendiente',
        newStatus: 'confirmado',
        changedAtIso: '2026-09-04T13:00:00Z',
        responsible: 'Sistema',
        note: null,
      },
      {
        previousStatus: 'confirmado',
        newStatus: 'en_produccion',
        changedAtIso: '2026-09-05T09:00:00Z',
        responsible: 'María Torres (Asesor)',
        note: null,
      },
      {
        previousStatus: 'en_produccion',
        newStatus: 'enviado',
        changedAtIso: '2026-09-06T17:00:00Z',
        responsible: 'María Torres (Asesor)',
        note: 'Entregado a la empresa de courier.',
      },
    ],
  },
];

/** Explicit empty fixture — used by the mock service's `?mockState=empty` preview path. */
export const ADMIN_ORDERS_EMPTY: readonly AdminOrderSeed[] = [];
