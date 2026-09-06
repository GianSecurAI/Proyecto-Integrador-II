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
  private readonly role = signal<'CLIENTE' | null>(null);

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly currentRole = computed(() => this.role());

  /** Called after a successful `/api/auth/otp/verify` response (FR-015: session carries CLIENTE). */
  markAuthenticated(role: 'CLIENTE' = 'CLIENTE'): void {
    this.authenticated.set(true);
    this.role.set(role);
  }

  /** Called on logout, or when the interceptor observes a 401 from a protected endpoint. */
  clear(): void {
    this.authenticated.set(false);
    this.role.set(null);
  }
}
