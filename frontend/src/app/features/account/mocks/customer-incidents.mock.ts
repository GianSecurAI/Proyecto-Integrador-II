import { IncidentStatus } from '../models/incident.model';

/**
 * Isolated seed fixtures for the RF-15 ("Registro de incidencias", actor Cliente,
 * docs/discovery/06-system-definition.md lines 219-220) preview screen. No `Incidencia` backend
 * entity exists yet (`backend/src` has zero matches) and no REST contract is defined — this
 * fixture, `../services/customer-incidents-mock.service.ts`, and `pages/incidents/` are entirely
 * frontend-only, mirroring the isolation pattern already used by
 * `features/account/mocks/customer-orders.mock.ts` and `customer-profile.mock.ts`.
 *
 * `orderId` values are deliberately drawn from real ids in `../mocks/customer-orders.mock.ts`'s
 * `CUSTOMER_ORDERS_SEED`, so the `Pedido 1---N Incidencia` relationship
 * (docs/discovery/06-system-definition.md line 162) stays internally consistent within this mock
 * module — this fixture must never reference an order id that isn't also present there.
 *
 * Field provenance (Constitution Principle I traceability), per the `Incidencia` entity at line
 * 143 ("Pedido asociado, descripción, prioridad, estado, resolución, fechas"): only `orderId` and
 * `description` are ever customer-provided at creation; `status`/`resolution` are staff/system-set
 * (RF-16/RF-18) and only ever displayed here, never edited by the customer. `priority` is entirely
 * omitted — see `../models/incident.model.ts`'s doc comment for why.
 */
export interface CustomerIncidentSeed {
  readonly id: string;
  readonly orderId: string;
  readonly description: string;
  readonly status: IncidentStatus;
  readonly resolution: string | null;
  readonly reportedAtIso: string; // ISO 8601
  readonly resolvedAtIso: string | null; // ISO 8601, present only once resolved
}

export const CUSTOMER_INCIDENTS_SEED: readonly CustomerIncidentSeed[] = [
  {
    id: 'INC-0001',
    orderId: 'PED-2031',
    description: 'Uno de los tres llaveros llegó con una fisura visible en la base.',
    status: 'resuelta',
    resolution:
      'Se coordinó el reenvío sin costo de la pieza dañada; el reemplazo fue entregado el 12/06.',
    reportedAtIso: '2026-06-10T09:00:00Z',
    resolvedAtIso: '2026-06-12T16:00:00Z',
  },
  {
    id: 'INC-0002',
    orderId: 'PED-2061',
    description:
      'El seguimiento del courier no se actualiza desde hace 3 días y no logro contactarlos.',
    status: 'en_revision',
    resolution: null,
    reportedAtIso: '2026-09-05T10:30:00Z',
    resolvedAtIso: null,
  },
  {
    id: 'INC-0003',
    orderId: 'PED-2050',
    description: 'Quisiera confirmar si el pedido sigue programado para la fecha estimada original.',
    status: 'abierta',
    resolution: null,
    reportedAtIso: '2026-09-06T08:15:00Z',
    resolvedAtIso: null,
  },
];

/** Explicit empty fixture — used by the mock service's `?mockState=empty` preview path so the
 * incidents page's "no incidents yet" state can be exercised deterministically without a real
 * customer with zero incidents. */
export const CUSTOMER_INCIDENTS_EMPTY: readonly CustomerIncidentSeed[] = [];
