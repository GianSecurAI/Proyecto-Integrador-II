import { Injectable, computed, signal } from '@angular/core';
import { AppRole } from '../auth/roles';

/**
 * The three states `authStatus` (below) can be in. Today the resolution is fully synchronous and
 * trivial (see the class doc comment for why), so in practice a consumer will never actually
 * observe `'checking'` — but the type exists so `authGuard`/any future bootstrap-time UI has a
 * well-defined "still resolving" moment to key off, without assuming session state is always
 * instantly known (forward-compatible with a real `GET /api/auth/me`-style check later).
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/**
 * Client-side, in-memory mirror of "are we currently authenticated" state.
 *
 * IMPORTANT (why this exists / its limits): the real session lives in a server-side, httpOnly
 * cookie (research.md §3) that Angular can never read or validate directly — the backend is
 * always the authority on whether a session is valid (Constitution Principle III: "the frontend
 * is never the source of truth"). This service only tracks what the app *optimistically* believes
 * right after a successful OTP verification, purely to drive client-side routing UX (e.g. not
 * flashing a protected page before the guard redirects, or not showing "sign in" again
 * immediately after verifying). It intentionally does not persist across a full page reload (no
 * localStorage/sessionStorage token caching), because there is nothing here that would be safe or
 * meaningful to trust without asking the backend again.
 *
 * Every actually-protected piece of data still goes through a real HTTP call that the backend
 * independently authorizes; a 401/403 from that call (handled by `error.interceptor.ts`) is the
 * authoritative signal, and it corrects this local flag if it was wrong (e.g. stale after logout
 * in another tab, or a session that expired server-side).
 *
 * NO FAKE "REMEMBER ME" / SESSION RESTORATION (deliberate, not an oversight): `authStatus` below
 * exists so a future real session check (`GET /api/auth/me`, reading the httpOnly cookie
 * server-side) has a natural "still checking" moment to occupy without a rewrite of every
 * consumer. Today there is no such backend call, so `resolveInitialStatus()` resolves
 * synchronously to `'anonymous'` at construction — every fresh page load starts signed out, on
 * purpose. Do NOT "fix" this by caching a token or a role in `localStorage`/`sessionStorage`:
 * that would (a) contradict this file's own reasoning above, (b) mean the frontend is trusting a
 * client-readable value for an authorization decision, which is exactly what Constitution
 * Principle III forbids, and (c) be worse than the current, honestly-limited behavior, not
 * better.
 */
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  private readonly authenticated = signal(false);
  private readonly role = signal<AppRole | null>(null);
  /** The authenticated user's own identity (currently just email — the only field the mock OTP
   * flow and the real `contracts/otp-auth-api.md` verify response both carry). Deliberately
   * separate from `role`: "who is signed in" and "what may they do" are two different pieces of
   * state, even though both are set together by `markAuthenticated`. */
  private readonly email = signal<string | null>(null);
  private readonly status = signal<AuthStatus>('checking');

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly currentRole = computed(() => this.role());
  readonly currentEmail = computed(() => this.email());
  readonly authStatus = computed(() => this.status());

  constructor() {
    this.resolveInitialStatus();
  }

  /**
   * Resolves the initial `authStatus` at app bootstrap. Today this is synchronous/trivial (there
   * is no real session to check, see the class doc comment) — it exists as its own method
   * specifically so a future real check (an httpOnly-cookie-backed `GET /api/auth/me` call) can
   * replace this one method's body with an async HTTP call that transitions `status` from
   * `'checking'` to `'authenticated'`/`'anonymous'` once the backend responds, without any other
   * consumer of this service needing to change.
   */
  private resolveInitialStatus(): void {
    this.status.set('anonymous');
  }

  /** Called after a successful `/api/auth/otp/verify` response (FR-015: session carries CLIENTE
   * by default; ADMINISTRADOR/ASESOR are carried the same way once role resolution exists — see
   * `features/auth/services/auth-preview.service.ts`/`AuthService`). `email` defaults to `null` so
   * every existing call site (spec tests, `AuthService.verifyOtp`) that only ever cared about role
   * keeps compiling and behaving exactly as before. */
  markAuthenticated(role: AppRole = 'CLIENTE', email: string | null = null): void {
    this.authenticated.set(true);
    this.role.set(role);
    this.email.set(email);
    this.status.set('authenticated');
  }

  /** Called on logout, or when the interceptor observes a 401 from a protected endpoint. */
  clear(): void {
    this.authenticated.set(false);
    this.role.set(null);
    this.email.set(null);
    this.status.set('anonymous');
  }
}
