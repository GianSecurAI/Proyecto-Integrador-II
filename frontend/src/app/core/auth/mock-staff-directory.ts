import { ADMIN_ROLE, ADVISOR_ROLE, AppRole, CUSTOMER_ROLE } from './roles';

/**
 * Canonical, single source of truth for "which mock email address resolves to which staff role"
 * in this preview build. No real identity/role lookup exists yet (no backend staff-auth endpoint,
 * no `docs/security/security-design.md`) — a real backend would resolve role from the account's
 * own persisted record, never from a client-side list like this one.
 *
 * Referenced by BOTH:
 * - `features/auth/services/auth-preview.service.ts` (resolves a role after OTP "verification",
 *   via `resolveMockRole` below).
 * - `features/admin/mocks/admin-users.mock.ts` (seeds the Usuarios admin screen's Asesor/
 *   Administrador rows).
 *
 * so there is never a second, independently-maintained list of "fake staff emails" that could
 * drift out of sync with this one. Deliberately lives in `core/` rather than inside either
 * feature, so neither `features/auth` nor `features/admin` has to import from the other — a
 * feature -> feature dependency flagged as a should-fix in
 * `docs/reviews/frontend-visual-review.md`.
 *
 * Any email not present here resolves to `CUSTOMER_ROLE` (see `resolveMockRole`) — this preserves
 * the already-approved FR-005 behavior: an unseen email's first successful OTP verification
 * creates an ordinary Cliente account. A real login never lets the visitor pick their own role;
 * role is always looked up server-side after credentials/OTP are confirmed, never chosen
 * up-front by the user — this directory mirrors that shape even though it is mock data.
 */
export interface MockStaffAccount {
  readonly email: string;
  readonly role: typeof ADMIN_ROLE | typeof ADVISOR_ROLE;
}

export const MOCK_ASESOR_ACCOUNT: MockStaffAccount = {
  email: 'asesor.andrea@armakers3d.com',
  role: ADVISOR_ROLE,
};

export const MOCK_ADMIN_ACCOUNT: MockStaffAccount = {
  email: 'admin.principal@armakers3d.com',
  role: ADMIN_ROLE,
};

export const MOCK_STAFF_DIRECTORY: readonly MockStaffAccount[] = [
  MOCK_ASESOR_ACCOUNT,
  MOCK_ADMIN_ACCOUNT,
];

/**
 * Resolves the role a mock OTP verification should carry for the given email. Case-insensitive,
 * whitespace-trimmed (mirrors the trimming `RequestCodePage`/`RegisterPage` already apply before
 * submitting). Unknown emails default to `CUSTOMER_ROLE`, never to a staff role — a mock account
 * directory miss must never accidentally grant elevated access.
 */
export function resolveMockRole(email: string): AppRole {
  const normalized = email.trim().toLowerCase();
  const match = MOCK_STAFF_DIRECTORY.find((account) => account.email.toLowerCase() === normalized);
  return match?.role ?? CUSTOMER_ROLE;
}
