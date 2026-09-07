import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { ADMIN_ORDERS_EMPTY, ADMIN_ORDERS_SEED, AdminOrderSeed } from '../mocks/admin-orders.mock';
import {
  AdminOrderSummaryViewModel,
  AdminOrderViewModel,
  RegisterPersonalizedOrderFormValue,
  isValidStatusTransition,
} from '../models/admin-order.model';
import { OrderKind, OrderStatus } from '../../account/models/order.model';

/**
 * Deterministic preview states, driven by the `?mockState=` route query param — same convention
 * already established by `AdminProductsMockState`/`OrdersMockState`.
 */
export type AdminOrdersMockState = 'populated' | 'empty' | 'error';

/**
 * Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure/not-found/invalid-transition from an unrelated bug —
 * mirrors `AdminProductsMockError`/`OrdersMockError`.
 */
export class AdminOrdersMockError extends Error {}

/**
 * TEMPORARY PREVIEW-ONLY MAGIC VALUE — lets a reviewer preview the "registration failed" error
 * state from the UI alone. Carries no security/validation meaning. Mirrors
 * `MOCK_PRODUCT_SAVE_FAILURE_MARKER`.
 */
export const MOCK_ORDER_SAVE_FAILURE_MARKER = '__mock_fail__';

function toKind(seed: AdminOrderSeed): OrderKind {
  return seed.quotationReference ? 'personalizado' : 'estandar';
}

function toStatus(seed: AdminOrderSeed): OrderStatus {
  return seed.history[seed.history.length - 1].newStatus;
}

function toSummaryViewModel(seed: AdminOrderSeed): AdminOrderSummaryViewModel {
  return {
    id: seed.id,
    placedAt: new Date(seed.placedAtIso),
    status: toStatus(seed),
    kind: toKind(seed),
    summary: seed.summary,
    customerEmail: seed.customerEmail,
    customerName: seed.customerName,
    customerPhone: seed.customerPhone,
  };
}

function toDetailViewModel(seed: AdminOrderSeed): AdminOrderViewModel {
  return {
    ...toSummaryViewModel(seed),
    statusHistory: seed.history.map((entry) => ({
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      changedAt: new Date(entry.changedAtIso),
      responsible: entry.responsible,
      note: entry.note,
    })),
  };
}

let nextMockOrderSequence = 1;

/**
 * Isolated, frontend-only, STAFF-SCOPED preview service for the RF-13 ("Gestión de los estados
 * del pedido") / RF-11 ("Registro de pedidos", flujo personalizado) admin order screens. No REST
 * contract is defined for staff order management yet — no `Pedido`/`Cotizacion`/
 * `HistorialEstadoPedido` backend entity exists in `backend/src`. Distinct from
 * `CustomerOrdersMockService` (that service represents "the current customer's own orders" and
 * has no notion of "which customer"); this service holds orders spanning MULTIPLE customers, seen
 * only by staff (Administrador/Asesor).
 *
 * Never touches `localStorage`/`sessionStorage`, never logs any order/customer data.
 *
 * Filtering (by id/customer email/status/kind) is deliberately NOT implemented here — it mirrors
 * `AdminProductListPage`'s exact "fetch once, filter locally via a computed signal" convention
 * (search/filter signals live in `AdminOrderListPage`, not in this service), consistent with
 * every other admin list in this codebase.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrdersMockService {
  private readonly orders = signal<readonly AdminOrderViewModel[]>(
    ADMIN_ORDERS_SEED.map(toDetailViewModel),
  );

  getOrders(mockState: AdminOrdersMockState = 'populated'): Observable<AdminOrderSummaryViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminOrdersMockError('Mock admin order list fetch failure')),
        ),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => ADMIN_ORDERS_EMPTY.map(toSummaryViewModel)));
    }
    // Fresh, mutable array (not the internal readonly signal value) — mirrors
    // `CustomerOrdersMockService.getOrders()`/`AdminProductsMockService.getProducts()`.
    return timer(400).pipe(map(() => [...this.orders()]));
  }

  /** Staff detail fetch. "Not found" is a REAL state (not simulated by `mockState`) — reachable by
   * navigating to any id absent from the seed, same convention as every other detail fetch in
   * this codebase. */
  getOrderById(
    id: string,
    mockState: AdminOrdersMockState = 'populated',
  ): Observable<AdminOrderViewModel> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminOrdersMockError('Mock admin order detail fetch failure')),
        ),
      );
    }
    return timer(400).pipe(
      switchMap(() => {
        const found = this.orders().find((order) => order.id === id);
        return found
          ? of(found)
          : throwError(() => new AdminOrdersMockError(`Mock admin order "${id}" not found`));
      }),
    );
  }

  /**
   * Applies a status transition, appending one `HistorialEstadoPedido` entry. Validates the
   * transition is present in `ORDER_STATUS_TRANSITIONS` (`../models/admin-order.model.ts`) BEFORE
   * "applying" it, and rejects/errors on an invalid attempt even though the UI never offers one —
   * defense in depth, the same "don't trust client-side validation alone" spirit as Constitution
   * Principle VIII, applied here even inside a mock (a future real backend MUST re-validate this
   * independently; this check is not a substitute for that).
   */
  transitionStatus(
    id: string,
    newStatus: OrderStatus,
    note: string | null = null,
  ): Observable<AdminOrderViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.orders().find((order) => order.id === id);
        if (!existing) {
          return throwError(() => new AdminOrdersMockError(`Mock admin order "${id}" not found`));
        }
        if (!isValidStatusTransition(existing.status, newStatus)) {
          return throwError(
            () =>
              new AdminOrdersMockError(
                `Invalid status transition: "${existing.status}" -> "${newStatus}"`,
              ),
          );
        }
        const updated: AdminOrderViewModel = {
          ...existing,
          status: newStatus,
          statusHistory: [
            ...existing.statusHistory,
            {
              previousStatus: existing.status,
              newStatus,
              changedAt: new Date(),
              // "Sistema"/named responsible are the only responsibles seeded so far — no staff
              // authentication flow exists yet to attribute this to a real logged-in advisor
              // name, so a generic staff label is used instead of inventing one.
              responsible: 'Personal (Asesor/Administrador)',
              note: note?.trim() || null,
            },
          ],
        };
        this.orders.update((current) => current.map((order) => (order.id === id ? updated : order)));
        return of(updated);
      }),
    );
  }

  /**
   * Registers a new `personalizado` order after the advisor has coordinated the sale over
   * WhatsApp and confirmed the external payment was received (`value.paymentConfirmed`,
   * validated as a required control by the calling form, re-checked here defensively). Never
   * processes, references, or calculates a payment of any kind (CLAUDE.md's "Business
   * clarification: purchasing flows" — the custom flow's payment stays entirely external) and
   * never derives `quotationAmount` from anything — it is always the advisor's manually-typed
   * figure (docs/discovery/06-system-definition.md line 96).
   *
   * Initial status is `confirmado`, not `pendiente`: unlike a standard catalog order (whose
   * `pendiente` state exists to represent "payment not yet confirmed by the gateway"), a
   * personalized order is only ever registered in the system AFTER the advisor has already
   * attested the external payment was received (line 95) — there is nothing left "pending" at
   * registration time.
   */
  registerPersonalizedOrder(
    value: RegisterPersonalizedOrderFormValue,
  ): Observable<AdminOrderViewModel> {
    if (!value.paymentConfirmed) {
      return timer(400).pipe(
        switchMap(() =>
          throwError(
            () =>
              new AdminOrdersMockError(
                'Cannot register a personalized order without confirmed external payment',
              ),
          ),
        ),
      );
    }
    if (value.customerEmail.includes(MOCK_ORDER_SAVE_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() =>
          throwError(() => new AdminOrdersMockError('Mock admin order registration failure')),
        ),
      );
    }
    const now = new Date();
    const quotationRef = `COT-MOCK-${nextMockOrderSequence}`;
    const created: AdminOrderViewModel = {
      id: `PED-MOCK-${nextMockOrderSequence++}`,
      placedAt: now,
      status: 'confirmado',
      kind: 'personalizado',
      summary: value.quotationDescription.trim(),
      customerEmail: value.customerEmail.trim(),
      statusHistory: [
        {
          previousStatus: null,
          newStatus: 'confirmado',
          changedAt: now,
          responsible: 'Personal (Asesor/Administrador)',
          note: `Pedido registrado tras confirmar el pago externo de la cotización ${quotationRef} (monto acordado: S/ ${value.quotationAmount.toFixed(2)}).`,
        },
      ],
    };
    return timer(500).pipe(
      map(() => {
        this.orders.update((current) => [created, ...current]);
        return created;
      }),
    );
  }
}
