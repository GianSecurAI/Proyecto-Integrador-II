import { Injectable, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { CUSTOMER_ORDERS_SEED } from '../mocks/customer-orders.mock';
import {
  CUSTOMER_INCIDENTS_EMPTY,
  CUSTOMER_INCIDENTS_SEED,
  CustomerIncidentSeed,
} from '../mocks/customer-incidents.mock';
import { IncidentViewModel, NewIncidentFormValue } from '../models/incident.model';

/**
 * Deterministic preview states, driven by the `?mockState=` route query param documented on
 * screen in `incidents.page.html` — same convention already established by `OrdersMockState`
 * (`./customer-orders-mock.service.ts`). `'populated'` is the default (real, seeded mock data);
 * `'empty'` and `'error'` exist purely so a reviewer can preview those UI states from the browser
 * URL bar alone, without a real backend to force them.
 */
export type IncidentsMockState = 'populated' | 'empty' | 'error';

/**
 * Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure from an unrelated bug, mirroring `OrdersMockError`.
 */
export class IncidentsMockError extends Error {}

/**
 * TEMPORARY PREVIEW-ONLY MAGIC VALUE.
 * Including this exact marker anywhere in a submitted description lets a reviewer/QA preview the
 * "submit failed" error state from the UI alone, without a real backend. It carries no security or
 * validation meaning whatsoever — a future integrator replacing this mock with a real incident
 * intake endpoint MUST delete this block entirely rather than adapt it. Mirrors
 * `MOCK_SAVE_FAILURE_PHONE` in `./customer-profile-mock.service.ts`.
 */
export const MOCK_SUBMIT_FAILURE_MARKER = '__mock_fail__';

const ORDER_SUMMARY_BY_ID = new Map(CUSTOMER_ORDERS_SEED.map((order) => [order.id, order.summary]));

/** Falls back to the raw id when an order isn't found in the seed (defensive only — every seeded
 * incident is authored to reference a real order id, see the mock fixture's doc comment). */
function orderSummaryFor(orderId: string): string {
  return ORDER_SUMMARY_BY_ID.get(orderId) ?? orderId;
}

function toViewModel(seed: CustomerIncidentSeed): IncidentViewModel {
  return {
    id: seed.id,
    orderId: seed.orderId,
    orderSummary: orderSummaryFor(seed.orderId),
    description: seed.description,
    status: seed.status,
    resolution: seed.resolution,
    reportedAt: new Date(seed.reportedAtIso),
    resolvedAt: seed.resolvedAtIso ? new Date(seed.resolvedAtIso) : null,
  };
}

let nextMockIncidentSequence = 1;

/**
 * Isolated, frontend-only preview service for the RF-15 ("Registro de incidencias", actor
 * Cliente) incidents screen. No REST contract is defined for listing or creating a customer's
 * incidents (see the mock fixture's doc comment) and no `Incidencia` backend entity exists yet.
 * Holds the seeded mock incidents as a signal (mirroring `CustomerOrdersMockService`) and
 * simulates network latency via `timer(...)` on every method. Reuses
 * `../mocks/customer-orders.mock.ts`'s seed for the order-summary lookup instead of re-mocking a
 * second, parallel order list.
 *
 * `submitIncident` always creates the new incident with status `abierta` and `resolution: null` —
 * the customer never sets status, resolution, or priority (RF-16/RF-17/RF-18 are staff-only, see
 * `../models/incident.model.ts`'s doc comment) — and appends it to the in-memory signal so a
 * subsequent `getIncidents()` reflects it immediately. Never touches `localStorage`/
 * `sessionStorage`, never logs any incident data.
 */
@Injectable({ providedIn: 'root' })
export class CustomerIncidentsMockService {
  private readonly incidents = signal<readonly IncidentViewModel[]>(
    CUSTOMER_INCIDENTS_SEED.map(toViewModel),
  );

  getIncidents(mockState: IncidentsMockState = 'populated'): Observable<IncidentViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() => throwError(() => new IncidentsMockError('Mock incident list fetch failure'))),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => [...CUSTOMER_INCIDENTS_EMPTY.map(toViewModel)]));
    }
    // Fresh, mutable array (not the internal readonly signal value) — mirrors
    // `CustomerOrdersMockService.getOrders()`'s exposure convention.
    return timer(400).pipe(map(() => [...this.incidents()]));
  }

  submitIncident(value: NewIncidentFormValue): Observable<IncidentViewModel> {
    if (value.description.includes(MOCK_SUBMIT_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() => throwError(() => new IncidentsMockError('Mock incident submit failure'))),
      );
    }
    const created: IncidentViewModel = {
      id: `INC-MOCK-${nextMockIncidentSequence++}`,
      orderId: value.orderId,
      orderSummary: orderSummaryFor(value.orderId),
      description: value.description.trim(),
      status: 'abierta',
      resolution: null,
      reportedAt: new Date(),
      resolvedAt: null,
    };
    return timer(500).pipe(
      map(() => {
        this.incidents.update((current) => [created, ...current]);
        return created;
      }),
    );
  }
}
