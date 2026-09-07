import { IncidentStatus } from '../../account/models/incident.model';
import { IncidentPriority } from '../models/admin-incident.model';

/**
 * Isolated, staff-scoped seed fixtures for the RF-16/RF-17/RF-18 admin incident screens
 * (`pages/incident-list/`, `pages/incident-detail/`). Distinct from
 * `features/account/mocks/customer-incidents.mock.ts` (which represents "the current customer's
 * own incidents") — this fixture spans MULTIPLE customers, since a staff screen must see every
 * customer's incidents, mirroring the exact same "isolated, frontend-only preview fixture, one
 * level up from the customer-scoped one" relationship `../mocks/admin-orders.mock.ts` already has
 * to `customer-orders.mock.ts`.
 *
 * `orderId` values are deliberately drawn from real ids in `./admin-orders.mock.ts`'s
 * `ADMIN_ORDERS_SEED` — this fixture must never reference an order id absent from there, so the
 * admin incidents mock service (`../services/admin-incidents-mock.service.ts`) can resolve
 * customer/order association by reusing that fixture instead of re-mocking a third, parallel
 * order/customer dataset.
 *
 * Field provenance mirrors `customer-incidents.mock.ts`'s doc comment (`Incidencia` entity, line
 * 143: "Pedido asociado, descripción, prioridad, estado, resolución, fechas") plus `priority`,
 * which the customer-scoped fixture deliberately omits (staff-only, RF-17).
 *
 * Resolution/status coupling (see the mock service's doc comment for the authoritative statement):
 * a non-null `resolution` only ever appears together with `status: 'resuelta'` and a non-null
 * `resolvedAtIso`, so this seed data stays consistent with what
 * `AdminIncidentsMockService.registerResolution` itself enforces at runtime. A `rechazada` entry
 * below has no resolution text — rejecting a report is a plain status change (the status-update
 * control), not a "resolution" in the RF-18 sense.
 *
 * Deliberately includes:
 * - incidents across four different orders/customers (reusing `ADMIN_ORDERS_SEED`'s ids).
 * - a mix of all four `IncidentStatus` values.
 * - a mix of all three `IncidentPriority` values.
 * - at least one incident with a registered resolution and several without.
 * - a customer with only an email on file (`PED-3005`) and one with an email + name but no phone
 *   (`PED-3003`) — exercising the same "optional field may be absent" degrade-gracefully cases
 *   `admin-orders.mock.ts` already established.
 */
export interface AdminIncidentSeed {
  readonly id: string;
  readonly orderId: string;
  readonly description: string;
  readonly status: IncidentStatus;
  readonly priority: IncidentPriority;
  readonly resolution: string | null;
  readonly reportedAtIso: string; // ISO 8601
  readonly resolvedAtIso: string | null; // ISO 8601, present only once resolved
}

export const ADMIN_INCIDENTS_SEED: readonly AdminIncidentSeed[] = [
  {
    id: 'INC-ADM-0001',
    orderId: 'PED-3001',
    description: 'Uno de los tres llaveros llegó con una fisura visible en la base.',
    status: 'resuelta',
    priority: 'media',
    resolution:
      'Se coordinó el reenvío sin costo de la pieza dañada; el reemplazo fue entregado el 12/06.',
    reportedAtIso: '2026-06-10T09:00:00Z',
    resolvedAtIso: '2026-06-12T16:00:00Z',
  },
  {
    id: 'INC-ADM-0002',
    orderId: 'PED-3002',
    description:
      'La figura personalizada llegó con un color distinto al acordado en la cotización COT-0117.',
    status: 'en_revision',
    priority: 'alta',
    resolution: null,
    reportedAtIso: '2026-07-20T14:00:00Z',
    resolvedAtIso: null,
  },
  {
    id: 'INC-ADM-0003',
    orderId: 'PED-3003',
    description: 'El cliente solicita confirmar el plazo de entrega del organizador modular.',
    status: 'abierta',
    priority: 'baja',
    resolution: null,
    reportedAtIso: '2026-08-21T11:00:00Z',
    resolvedAtIso: null,
  },
  {
    id: 'INC-ADM-0004',
    orderId: 'PED-3005',
    description:
      'El cliente reporta que la réplica del trofeo llegó a una dirección distinta a la registrada.',
    status: 'rechazada',
    priority: 'baja',
    resolution: null,
    reportedAtIso: '2026-09-01T10:00:00Z',
    resolvedAtIso: null,
  },
  {
    id: 'INC-ADM-0005',
    orderId: 'PED-3004',
    description: 'La maceta llegó con un pequeño astillado en el borde superior.',
    status: 'abierta',
    priority: 'media',
    resolution: null,
    reportedAtIso: '2026-04-20T08:30:00Z',
    resolvedAtIso: null,
  },
  {
    id: 'INC-ADM-0006',
    orderId: 'PED-3006',
    description: 'El seguimiento del courier no se actualiza desde hace 3 días.',
    status: 'en_revision',
    priority: 'baja',
    resolution: null,
    reportedAtIso: '2026-09-06T09:45:00Z',
    resolvedAtIso: null,
  },
];

/** Explicit empty fixture — used by the mock service's `?mockState=empty` preview path. */
export const ADMIN_INCIDENTS_EMPTY: readonly AdminIncidentSeed[] = [];
