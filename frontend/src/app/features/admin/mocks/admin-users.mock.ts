import { AdminUserRole } from '../models/admin-user.model';

/**
 * Seed fixture for the RF-03 admin user-management screens (`pages/user-list/`,
 * `pages/user-detail/`), isolated per this codebase's established convention (one dedicated
 * `mocks/admin-*.mock.ts` file per admin domain — see `admin-products.mock.ts`/
 * `admin-incidents.mock.ts`). Field shape mirrors `AdminUserSeed` directly to `AdminUserViewModel`
 * (`createdAtIso` -> `memberSince`, same `...IsoString -> Date` mapping convention as
 * `AdminIncidentSeed.reportedAtIso`), so `AdminUsersMockService`'s `toViewModel` needs no
 * additional transformation beyond that date parse.
 *
 * Deliberately includes:
 * - several `CLIENTE` accounts (the most common seeded role, by far).
 * - at least one `ASESOR` and at least one `ADMINISTRADOR` account.
 * - at least one inactive (`active: false`) account, so the list's status badge/filter and the
 *   detail page's reactivation path are both exercised.
 */
export interface AdminUserSeed {
  readonly id: string;
  readonly email: string;
  readonly role: AdminUserRole;
  readonly createdAtIso: string;
  readonly active: boolean;
}

export const ADMIN_USERS_SEED: readonly AdminUserSeed[] = [
  {
    id: 'usr-1',
    email: 'maria.gonzales@example.com',
    role: 'CLIENTE',
    createdAtIso: '2025-01-14T15:20:00Z',
    active: true,
  },
  {
    id: 'usr-2',
    email: 'jose.ramirez@example.com',
    role: 'CLIENTE',
    createdAtIso: '2025-02-02T10:05:00Z',
    active: true,
  },
  {
    id: 'usr-3',
    email: 'lucia.fernandez@example.com',
    role: 'CLIENTE',
    createdAtIso: '2025-03-19T08:45:00Z',
    active: false,
  },
  {
    id: 'usr-4',
    email: 'diego.torres@example.com',
    role: 'CLIENTE',
    createdAtIso: '2025-04-30T18:10:00Z',
    active: true,
  },
  {
    id: 'usr-5',
    email: 'asesor.andrea@armakers3d.com',
    role: 'ASESOR',
    createdAtIso: '2024-11-05T09:00:00Z',
    active: true,
  },
  {
    id: 'usr-6',
    email: 'admin.principal@armakers3d.com',
    role: 'ADMINISTRADOR',
    createdAtIso: '2024-09-01T09:00:00Z',
    active: true,
  },
];

/** Explicit empty fixture — used by `AdminUsersMockService`'s `?mockState=empty` preview path,
 * same convention as `ADMIN_PRODUCTS_EMPTY`/`ADMIN_INCIDENTS_EMPTY`. */
export const ADMIN_USERS_EMPTY: readonly AdminUserSeed[] = [];
