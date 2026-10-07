import { Injectable, computed, signal } from '@angular/core';
import { AppRole } from '../auth/roles';

/**
 * `'checking'` only until the app-start `GET /api/auth/me` call settles (see
 * `AuthService.restoreSession`, wired through `provideAppInitializer` in `app.config.ts`);
 * afterwards `'authenticated'` or `'anonymous'`.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/**
 * Client-side, in-memory mirror of "who does the SERVER say is signed in".
 *
 * The real session lives in an httpOnly cookie the browser never exposes to scripts; the backend
 * is the only authority (Constitution Principle III). This service only holds what the server
 * last told us — via `POST /api/auth/otp/verify` + `GET /api/auth/me` after login, or `GET
 * /api/auth/me` on app start — so routing/guards and the header can react without a request per
 * navigation. Role checks made from this state (`authGuard`, menus) are UX only; every protected
 * endpoint is independently authorized server-side, and a 401/403 from one (handled by
 * `error.interceptor.ts`) corrects this state.
 *
 * Nothing is persisted: no token, role or flag goes to localStorage/sessionStorage. A page reload
 * starts as `'checking'` and is resolved by asking the backend again.
 */
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  private readonly authenticated = signal(false);
  private readonly role = signal<AppRole | null>(null);
  private readonly email = signal<string | null>(null);
  private readonly userId = signal<number | null>(null);
  private readonly status = signal<AuthStatus>('checking');

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly currentRole = computed(() => this.role());
  readonly currentEmail = computed(() => this.email());
  /** Server-assigned account id (from `/api/auth/me`); used to scope per-user client state such
   * as the cart. Not an authorization value. */
  readonly currentUserId = computed(() => this.userId());
  readonly authStatus = computed(() => this.status());

  /** Records the identity the backend reported. */
  markAuthenticated(
    role: AppRole = 'CLIENTE',
    email: string | null = null,
    userId: number | null = null,
  ): void {
    this.authenticated.set(true);
    this.role.set(role);
    this.email.set(email);
    this.userId.set(userId);
    this.status.set('authenticated');
  }

  /** Logout, or a 401 observed from the backend, or `/me` answering "not signed in". */
  clear(): void {
    this.authenticated.set(false);
    this.role.set(null);
    this.email.set(null);
    this.userId.set(null);
    this.status.set('anonymous');
  }
}
