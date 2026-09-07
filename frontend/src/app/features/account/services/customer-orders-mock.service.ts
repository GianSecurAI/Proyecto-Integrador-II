import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { CUSTOMER_ORDERS_EMPTY, CUSTOMER_ORDERS_SEED, CustomerOrderSeed } from '../mocks/customer-orders.mock';
import { OrderDetailViewModel, OrderKind, OrderStatus, OrderSummaryViewModel } from '../models/order.model';

/**
 * Deterministic preview states, driven by the `?mockState=` route query param documented on
 * screen in both `order-history.page.html` and `order-detail.page.html`. `'populated'` is the
 * default (real, seeded mock data); `'empty'` and `'error'` exist purely so a reviewer can
 * preview those UI states from the browser URL bar alone, without a real backend to force them.
 */
export type OrdersMockState = 'populated' | 'empty' | 'error';

/**
 * Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure/not-found from an unrelated bug, mirroring
 * `AuthPreviewError` in `features/auth/services/auth-preview.service.ts`.
 */
export class OrdersMockError extends Error {}

function toKind(seed: CustomerOrderSeed): OrderKind {
  return seed.quotationReference ? 'personalizado' : 'estandar';
}

function toStatus(seed: CustomerOrderSeed): OrderStatus {
  return seed.history[seed.history.length - 1].newStatus;
}

function toSummaryViewModel(seed: CustomerOrderSeed): OrderSummaryViewModel {
  return {
    id: seed.id,
    placedAt: new Date(seed.placedAtIso),
    status: toStatus(seed),
    kind: toKind(seed),
    summary: seed.summary,
  };
}

function toDetailViewModel(seed: CustomerOrderSeed): OrderDetailViewModel {
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

/**
 * Isolated, frontend-only preview service for the RF-05/RF-12/RF-14 order screens. No REST
 * contract is defined for listing or reading a customer's orders (see the mock fixture's doc
 * comment) and no `Pedido` backend entity exists yet. Holds the seeded mock orders as a signal
 * (mirroring `CustomerProfileMockService`) and simulates network latency via `timer(...)` on
 * every method. Never touches `localStorage`/`sessionStorage`, never logs any order data.
 *
 * `getOrderById`'s "not found" case is a REAL state (not simulated by `mockState`) — reachable by
 * navigating to any id absent from the seed — same convention already used by
 * `ProductDetailPage`'s "Producto no encontrado" state for an unknown catalog id.
 */
@Injectable({ providedIn: 'root' })
export class CustomerOrdersMockService {
  private readonly orders = signal<readonly OrderDetailViewModel[]>(
    CUSTOMER_ORDERS_SEED.map(toDetailViewModel),
  );

  getOrders(mockState: OrdersMockState = 'populated'): Observable<OrderSummaryViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() => throwError(() => new OrdersMockError('Mock order list fetch failure'))),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => CUSTOMER_ORDERS_EMPTY.map(toSummaryViewModel)));
    }
    // `[...this.orders()]` rather than returning the readonly signal value directly: produces a
    // fresh, mutable `OrderSummaryViewModel[]` (each `OrderDetailViewModel` structurally
    // satisfies that narrower type) without exposing the service's internal readonly array.
    return timer(400).pipe(map(() => [...this.orders()]));
  }

  getOrderById(
    id: string,
    mockState: OrdersMockState = 'populated',
  ): Observable<OrderDetailViewModel> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() => throwError(() => new OrdersMockError('Mock order detail fetch failure'))),
      );
    }
    return timer(400).pipe(
      switchMap(() => {
        const found = this.orders().find((order) => order.id === id);
        return found
          ? of(found)
          : throwError(() => new OrdersMockError(`Mock order "${id}" not found`));
      }),
    );
  }
}
