import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { SessionStateService } from '../services/session-state.service';

/**
 * Route guard for session-gated routes, meant to be reused by every future feature that needs
 * an "only a signed-in customer may see this" boundary (plan.md: `core/` guard is shared
 * infrastructure, not specific to the auth feature's own two screens).
 *
 * T013 (foundational): presence check only — redirect to the "continue with email" page when
 * there is no locally known session.
 * T052 (US4): adds the role check — a route may declare `data: { role: 'CLIENTE' }` (or any
 * future role) and is redirected to the forbidden view if the locally known role does not match.
 *
 * T0xx (admin orders/RBAC widening): `data.role` may now also be an array of allowed roles
 * (e.g. `data: { role: ['ADMINISTRADOR', 'ASESOR'] }`), so a route reachable by more than one
 * staff role does not have to pick just one — every existing single-string usage (e.g.
 * `/account` -> `'CLIENTE'`) keeps working unchanged.
 *
 * Non-obvious "why": this guard is a UX convenience, not the security boundary itself
 * (Constitution Principle III — the frontend is never authoritative for permissions). It only
 * ever consults `SessionStateService`'s in-memory flag, which mirrors what the backend told us
 * at verification time; it never invents or evaluates a permission decision itself (Prohibited
 * Practice #5). The actual authorization decision for any protected resource is made
 * server-side on every request (contracts/otp-auth-api.md — 401/403), and
 * `core/interceptors/error.interceptor.ts` is what reacts to the backend's authoritative
 * verdict if this guard's optimistic local state ever turns out to be stale (e.g. session
 * expired server-side, or another tab logged out).
 */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const session = inject(SessionStateService);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    return router.createUrlTree(['/auth/request-code'], {
      queryParams: {
        returnUrl: route.pathFromRoot.map((s) => s.url.join('/')).join('/') || undefined,
      },
    });
  }

  const requiredRole = route.data?.['role'] as string | readonly string[] | undefined;
  if (requiredRole) {
    const currentRole = session.currentRole();
    const allowed = Array.isArray(requiredRole)
      ? currentRole !== null && requiredRole.includes(currentRole)
      : currentRole === requiredRole;
    if (!allowed) {
      return router.createUrlTree(['/forbidden']);
    }
  }

  return true;
};
