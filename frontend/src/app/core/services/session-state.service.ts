import { Injectable, computed, signal } from '@angular/core';

/**
 * Client-side, in-memory mirror of "are we currently authenticated" state.
 *
 * IMPORTANT (why this exists / its limits): the real session lives in a server-side,
 * httpOnly cookie (research.md §3) that Angular can never read or validate directly — the
 * backend is always the authority on whether a session is valid (Constitution Principle III:
 * "the frontend is never the source of truth"). This service only tracks what the app
 * *optimistically* believes right after a successful OTP verification, purely to drive
 * client-side routing UX (e.g. not flashing a protected page before the guard redirects, or
 * not showing "sign in" again immediately after verifying). It intentionally does not persist
 * across a full page reload (no localStorage/sessionStorage token caching), because there is
 * nothing here that would be safe or meaningful to trust without asking the backend again.
 *
 * Every actually-protected piece of data still goes through a real HTTP call that the backend
 * independently authorizes; a 401/403 from that call (handled by `error.interceptor.ts`) is
 * the authoritative signal, and it corrects this local flag if it was wrong (e.g. stale after
 * logout in another tab, or a session that expired server-side).
 */
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  private readonly authenticated = signal(false);
  // Widened to include 'ADMINISTRADOR' so the `/admin` route tree (features/admin/) can declare
  // `data: { role: 'ADMINISTRADOR' }` the same way `/account` already declares `role: 'CLIENTE'`
  // (see `app.routes.ts`). No admin authentication flow exists yet — this is purely a type-level
  // widening so `authGuard` can express the future role check; `markAuthenticated`'s default
  // stays 'CLIENTE' and every existing CLIENTE flow is unchanged.
  private readonly role = signal<'CLIENTE' | 'ADMINISTRADOR' | null>(null);

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly currentRole = computed(() => this.role());

  /** Called after a successful `/api/auth/otp/verify` response (FR-015: session carries CLIENTE). */
  markAuthenticated(role: 'CLIENTE' | 'ADMINISTRADOR' = 'CLIENTE'): void {
    this.authenticated.set(true);
    this.role.set(role);
  }

  /** Called on logout, or when the interceptor observes a 401 from a protected endpoint. */
  clear(): void {
    this.authenticated.set(false);
    this.role.set(null);
  }
}
