import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import {
  ADMIN_INCIDENTS_EMPTY,
  ADMIN_INCIDENTS_SEED,
  AdminIncidentSeed,
} from '../mocks/admin-incidents.mock';
import { ADMIN_ORDERS_SEED } from '../mocks/admin-orders.mock';
import { AdminIncidentViewModel, IncidentPriority } from '../models/admin-incident.model';
import { IncidentStatus } from '../../account/models/incident.model';

/** Deterministic preview states, driven by the `?mockState=` route query param — same convention
 * already established by `AdminOrdersMockState`/`IncidentsMockState`. */
export type AdminIncidentsMockState = 'populated' | 'empty' | 'error';

/** Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure/not-found from an unrelated bug — mirrors
 * `AdminOrdersMockError`/`IncidentsMockError`. */
export class AdminIncidentsMockError extends Error {}

/** TEMPORARY PREVIEW-ONLY MAGIC VALUE — lets a reviewer preview the "resolution registration
 * failed" error state from the UI alone. Carries no security/validation meaning. Mirrors
 * `MOCK_SUBMIT_FAILURE_MARKER`/`MOCK_ORDER_SAVE_FAILURE_MARKER`. */
export const MOCK_RESOLUTION_SAVE_FAILURE_MARKER = '__mock_fail__';

const ORDER_BY_ID = new Map(ADMIN_ORDERS_SEED.map((order) => [order.id, order]));

/** Resolves the customer/order association for a seeded incident by reusing
 * `ADMIN_ORDERS_SEED` — never re-mocks a second, parallel order/customer dataset. Falls back to a
 * defensive placeholder when an order id isn't found (should never happen for a correctly-authored
 * seed entry — see `../mocks/admin-incidents.mock.ts`'s doc comment), mirroring
 * `customer-incidents-mock.service.ts`'s `orderSummaryFor` fallback discipline. */
function customerAndSummaryFor(orderId: string): {
  orderSummary: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
} {
  const order = ORDER_BY_ID.get(orderId);
  return {
    orderSummary: order?.summary ?? orderId,
    customerEmail: order?.customerEmail ?? '(cliente desconocido)',
    customerName: order?.customerName,
    customerPhone: order?.customerPhone,
  };
}

function toViewModel(seed: AdminIncidentSeed): AdminIncidentViewModel {
  return {
    id: seed.id,
    orderId: seed.orderId,
    ...customerAndSummaryFor(seed.orderId),
    description: seed.description,
    status: seed.status,
    priority: seed.priority,
    resolution: seed.resolution,
    reportedAt: new Date(seed.reportedAtIso),
    resolvedAt: seed.resolvedAtIso ? new Date(seed.resolvedAtIso) : null,
  };
}

/**
 * Isolated, frontend-only, STAFF-SCOPED preview service for the RF-16 ("Gestión de estados de
 * incidencias")/RF-17 ("Clasificación de prioridad")/RF-18 ("Registro de resolución") admin
 * incident screens. No REST contract is defined yet — no `Incidencia` backend entity exists in
 * `backend/src`. Distinct from `CustomerIncidentsMockService` (that service represents "the
 * current customer's own incidents" and has no notion of "which customer"); this service holds
 * incidents spanning MULTIPLE customers, seen only by staff (Administrador/Asesor), reusing
 * `AdminOrdersMockService`'s seeded orders (via `ADMIN_ORDERS_SEED` directly, since both live in
 * the same feature) for the order/customer association rather than re-mocking a third dataset.
 *
 * Never touches `localStorage`/`sessionStorage`, never logs any incident/customer data.
 *
 * RESOLUTION/STATUS COUPLING (design decision, documented once here as the source of truth):
 * `registerResolution` ALWAYS also transitions `status` to `'resuelta'` and sets `resolvedAt` to
 * the current time in the same update — resolution text, resolved-at date, and "resuelta" status
 * are kept as one atomic fact so they can never disagree, the same single-source-of-truth
 * discipline `AdminOrdersMockService.transitionStatus` already applies to order status vs. its
 * history. `updateStatus` is the separate, independent control for every OTHER status change
 * (e.g. marking an incident `rechazada`, or moving it to `en_revision`) — it never touches
 * `resolution`/`resolvedAt`, so setting a status other than `resuelta` after a resolution was
 * already registered intentionally leaves the previous resolution text in place (treated as a
 * persisted note of what was resolved, not silently discarded).
 *
 * Filtering (by description text/status/priority) is deliberately NOT implemented here — mirrors
 * `AdminOrdersMockService`'s "fetch once, filter locally via a computed signal" convention (search/
 * filter signals live in `AdminIncidentListPage`, not in this service).
 */
@Injectable({ providedIn: 'root' })
export class AdminIncidentsMockService {
  private readonly incidents = signal<readonly AdminIncidentViewModel[]>(
    ADMIN_INCIDENTS_SEED.map(toViewModel),
  );

  getIncidents(
    mockState: AdminIncidentsMockState = 'populated',
  ): Observable<AdminIncidentViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminIncidentsMockError('Mock admin incident list fetch failure')),
        ),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => ADMIN_INCIDENTS_EMPTY.map(toViewModel)));
    }
    // Fresh, mutable array (not the internal readonly signal value) — mirrors
    // `AdminOrdersMockService.getOrders()`.
    return timer(400).pipe(map(() => [...this.incidents()]));
  }

  /** Staff detail fetch. "Not found" is a REAL state (not simulated by `mockState`) — reachable by
   * navigating to any id absent from the seed, same convention as every other detail fetch in this
   * codebase. */
  getIncidentById(
    id: string,
    mockState: AdminIncidentsMockState = 'populated',
  ): Observable<AdminIncidentViewModel> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(
            () => new AdminIncidentsMockError('Mock admin incident detail fetch failure'),
          ),
        ),
      );
    }
    return timer(400).pipe(
      switchMap(() => {
        const found = this.incidents().find((incident) => incident.id === id);
        return found
          ? of(found)
          : throwError(() => new AdminIncidentsMockError(`Mock admin incident "${id}" not found`));
      }),
    );
  }

  /** RF-16 — sets a new status directly, independent of `resolution`/`resolvedAt` (see this
   * class's doc comment for the full coupling rationale). No transition graph is enforced (no
   * discovery document defines one for incidents, unlike orders' `ORDER_STATUS_TRANSITIONS`) — any
   * of the four `IncidentStatus` values may follow any other. */
  updateStatus(id: string, status: IncidentStatus): Observable<AdminIncidentViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.incidents().find((incident) => incident.id === id);
        if (!existing) {
          return throwError(
            () => new AdminIncidentsMockError(`Mock admin incident "${id}" not found`),
          );
        }
        const updated: AdminIncidentViewModel = { ...existing, status };
        this.incidents.update((current) =>
          current.map((incident) => (incident.id === id ? updated : incident)),
        );
        return of(updated);
      }),
    );
  }

  /** RF-17. */
  updatePriority(id: string, priority: IncidentPriority): Observable<AdminIncidentViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.incidents().find((incident) => incident.id === id);
        if (!existing) {
          return throwError(
            () => new AdminIncidentsMockError(`Mock admin incident "${id}" not found`),
          );
        }
        const updated: AdminIncidentViewModel = { ...existing, priority };
        this.incidents.update((current) =>
          current.map((incident) => (incident.id === id ? updated : incident)),
        );
        return of(updated);
      }),
    );
  }

  /** RF-18 — see this class's doc comment for the resolution/status/resolvedAt coupling. */
  registerResolution(id: string, resolutionText: string): Observable<AdminIncidentViewModel> {
    if (resolutionText.includes(MOCK_RESOLUTION_SAVE_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() =>
          throwError(() => new AdminIncidentsMockError('Mock admin resolution save failure')),
        ),
      );
    }
    return timer(500).pipe(
      switchMap(() => {
        const existing = this.incidents().find((incident) => incident.id === id);
        if (!existing) {
          return throwError(
            () => new AdminIncidentsMockError(`Mock admin incident "${id}" not found`),
          );
        }
        const updated: AdminIncidentViewModel = {
          ...existing,
          resolution: resolutionText.trim(),
          status: 'resuelta',
          resolvedAt: new Date(),
        };
        this.incidents.update((current) =>
          current.map((incident) => (incident.id === id ? updated : incident)),
        );
        return of(updated);
      }),
    );
  }
}
