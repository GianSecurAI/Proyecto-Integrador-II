/**
 * Centralized, typed role model for route authorization (`app.routes.ts`) and any other place
 * that needs to reason about "which role(s) may reach this screen". This file is a single
 * declarative source of truth for the *shape* of a role check — it is deliberately NOT a new
 * runtime authorization engine. The actual enforcement still lives entirely in
 * `core/guards/auth.guard.ts`, which is simply fed these named constants instead of scattered
 * inline role-array literals repeated across `app.routes.ts`. See that guard's doc comment for
 * why any frontend role check is UX convenience only (Constitution Principle III — "the frontend
 * is never the source of truth" for permissions), never the real security boundary; a real
 * backend independently re-authorizes every request regardless of what this file says.
 *
 * The three roles below are the confirmed actors from `.specify/memory/constitution.md`
 * (Principle VII) / `docs/discovery/06-system-definition.md` — Cliente, Asesor, Administrador.
 * "Visitor" (unauthenticated) is represented by the absence of a role, not a fourth literal here.
 */
export type AppRole = 'CLIENTE' | 'ADMINISTRADOR' | 'ASESOR';

// Declared with literal types (`as const`), not widened to `AppRole`, so consumers like
// `core/auth/mock-staff-directory.ts` can build a narrower type (e.g. `typeof ADMIN_ROLE |
// typeof ADVISOR_ROLE`, excluding CUSTOMER_ROLE) directly from these constants.
export const CUSTOMER_ROLE = 'CLIENTE' as const;
export const ADMIN_ROLE = 'ADMINISTRADOR' as const;
export const ADVISOR_ROLE = 'ASESOR' as const;

/** `/account` boundary — the customer-facing area (RF-05/RF-12/RF-14/RF-15). */
export const CUSTOMER_ROLES: readonly AppRole[] = [CUSTOMER_ROLE];

/**
 * Both staff roles — the `/admin` shell's parent-level boundary. Administrador and Asesor share
 * the orders (RF-13), quotations (RF-10) and incidents (RF-16/17/18) domains; only products
 * (RF-07), reports (RF-19) and users (RF-03) narrow further to `ADMIN_ONLY_ROLES` below via their
 * own child-route guard.
 */
export const STAFF_ROLES: readonly AppRole[] = [ADMIN_ROLE, ADVISOR_ROLE];

/** Administrador-only child routes within `/admin` (products, reports, users — see above). */
export const ADMIN_ONLY_ROLES: readonly AppRole[] = [ADMIN_ROLE];

/**
 * Post-login navigation default, keyed by role — pure UX convenience for
 * `VerifyCodePage.navigateAfterLogin`, not an authorization decision (the destination route's own
 * guard re-checks access independently of how the visitor got there). An explicit `returnUrl`
 * query param (set by `authGuard` when it redirected an unauthenticated visitor here) always
 * takes priority over this default — see `core/guards/auth.guard.ts`.
 */
export function defaultRouteForRole(role: AppRole): string {
  if (role === 'CLIENTE') return '/account';
  // Both staff roles land on the admin shell's bare `/admin`, which now correctly redirects to
  // `orders` (reachable by both ADMINISTRADOR and ASESOR) rather than the Administrador-only
  // `products` default it used to carry — see `app.routes.ts`.
  return '/admin';
}
