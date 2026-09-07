import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { ADMIN_USERS_EMPTY, ADMIN_USERS_SEED, AdminUserSeed } from '../mocks/admin-users.mock';
import { AdminUserRole, AdminUserViewModel } from '../models/admin-user.model';

/** Deterministic preview states, driven by the `?mockState=` route query param — same convention
 * already established by `AdminProductsMockState`/`AdminIncidentsMockState`. */
export type AdminUsersMockState = 'populated' | 'empty' | 'error';

/** Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure/not-found from an unrelated bug — mirrors
 * `AdminProductsMockError`/`AdminIncidentsMockError`. */
export class AdminUsersMockError extends Error {}

function toViewModel(seed: AdminUserSeed): AdminUserViewModel {
  return {
    id: seed.id,
    email: seed.email,
    role: seed.role,
    memberSince: new Date(seed.createdAtIso),
    active: seed.active,
  };
}

/**
 * Isolated, frontend-only preview service for the RF-03 ("Autorización por rol / gestión de
 * roles y permisos", actor Administrador) admin user-management screens. No REST contract is
 * defined yet — no role/permission matrix exists anywhere in the discovery docs (line 100 of
 * `docs/discovery/06-system-definition.md`), and `docs/security/security-design.md` does not
 * exist. Holds the seeded mock users as a signal (mirroring `AdminProductsMockService`) and
 * simulates network latency via `timer(...)` on every method.
 *
 * PRIVACY DISCIPLINE (deliberate, not incidental): this service NEVER calls `console.*`, NEVER
 * touches `localStorage`/`sessionStorage`, and NEVER logs any user data — especially email
 * addresses, which are personal data. `docs/discovery/06-system-definition.md` line 212 flags
 * exactly this kind of screen (one that renders real account/email data) as needing care around
 * exposing personal data. Real audit logging of administrative operations on user accounts is a
 * legitimate future backend concern, but it is explicitly OUT OF SCOPE here — this file simply
 * never introduces a client-side log of that data in the first place.
 *
 * `getUserById`'s "not found" case is a REAL state (not simulated by `mockState`) — reachable by
 * navigating to any id absent from the seed, same convention as `AdminProductsMockService.
 * getProductById`.
 *
 * `changeRole` and `setActive` are separate, dedicated mutation methods — mirroring
 * `AdminProductsMockService.setAvailability` being its own method rather than folded into a
 * general "update user" call — because both are gated, single-purpose actions triggered from
 * their own dedicated controls on `AdminUserDetailPage`, never from a general edit form (there is
 * no general edit form for a `Usuario`; email/memberSince are never editable at all).
 *
 * NOTE ON AUTHORIZATION: nothing in this service simulates or performs a real authorization
 * decision — it only mutates the in-memory mock signal, exactly like every other admin mutation
 * in this codebase. Real enforcement of who may change a role or (de)activate an account is a
 * server-side concern that does not exist yet (Constitution Principle III: "the frontend is never
 * the source of truth"; Prohibited Practice #5).
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersMockService {
  private readonly users = signal<readonly AdminUserViewModel[]>(
    ADMIN_USERS_SEED.map(toViewModel),
  );

  getUsers(mockState: AdminUsersMockState = 'populated'): Observable<AdminUserViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() => throwError(() => new AdminUsersMockError('Mock admin user list fetch failure'))),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => ADMIN_USERS_EMPTY.map(toViewModel)));
    }
    // Fresh, mutable array (not the internal readonly signal value) — mirrors
    // `AdminProductsMockService.getProducts()`'s exposure convention.
    return timer(400).pipe(map(() => [...this.users()]));
  }

  getUserById(
    id: string,
    mockState: AdminUsersMockState = 'populated',
  ): Observable<AdminUserViewModel> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminUsersMockError('Mock admin user detail fetch failure')),
        ),
      );
    }
    return timer(400).pipe(
      switchMap(() => {
        const found = this.users().find((user) => user.id === id);
        return found
          ? of(found)
          : throwError(() => new AdminUsersMockError(`Mock admin user "${id}" not found`));
      }),
    );
  }

  /** RF-03 — reassigns a user's role. The detail page confirms this through
   * `AdminConfirmDialogComponent` before ever calling this method (see that page's doc comment);
   * this service itself performs no confirmation and no business decision about which
   * transitions are allowed — it simply persists whichever role the UI already confirmed. */
  changeRole(id: string, newRole: AdminUserRole): Observable<AdminUserViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.users().find((user) => user.id === id);
        if (!existing) {
          return throwError(() => new AdminUsersMockError(`Mock admin user "${id}" not found`));
        }
        const updated: AdminUserViewModel = { ...existing, role: newRole };
        this.users.update((current) => current.map((user) => (user.id === id ? updated : user)));
        return of(updated);
      }),
    );
  }

  /** RF-03-adjacent account status control — mirrors `AdminProductsMockService.setAvailability`'s
   * asymmetric gating exactly: deactivating (`true -> false`) is confirmed by the detail page's
   * confirm dialog before this is called; reactivating (`false -> true`) is called immediately. */
  setActive(id: string, active: boolean): Observable<AdminUserViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.users().find((user) => user.id === id);
        if (!existing) {
          return throwError(() => new AdminUsersMockError(`Mock admin user "${id}" not found`));
        }
        const updated: AdminUserViewModel = { ...existing, active };
        this.users.update((current) => current.map((user) => (user.id === id ? updated : user)));
        return of(updated);
      }),
    );
  }
}
