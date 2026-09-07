import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { CartItem } from '../../cart/models/cart-item.model';
import { CUSTOMER_ORDERS_EMPTY, CUSTOMER_ORDERS_SEED, CustomerOrderSeed } from '../mocks/customer-orders.mock';
import { OrderDetailViewModel, OrderKind, OrderStatus, OrderSummaryViewModel } from '../models/order.model';

/**
 * TEMPORARY PREVIEW-ONLY MAGIC VALUE — lets a reviewer preview `createStandardOrder`'s failure
 * state from the checkout UI alone (documented on-screen in the delivery-info step, mirroring
 * `MOCK_SAVE_FAILURE_PHONE`/`MOCK_SUBMIT_FAILURE_MARKER`/`MOCK_ORDER_SAVE_FAILURE_MARKER`
 * elsewhere in this codebase). Carries no security/validation meaning. A future integrator
 * replacing this mock with a real order-creation endpoint MUST delete this block entirely rather
 * than adapt it.
 */
export const MOCK_ORDER_SUBMIT_FAILURE_MARKER = '__mock_fail__';

let nextStandardOrderSequence = 1;

/** Builds the short `summary` string (see `OrderSummaryViewModel`'s doc comment — a plain short
 * string, NOT an itemized line-item breakdown; `PedidoItem` is not modeled yet). Purely a
 * presentation label, not a business decision. */
function buildStandardOrderSummary(items: readonly CartItem[]): string {
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
  const firstTitle = items[0]?.title ?? 'Producto';
  const extraLines = items.length - 1;
  const extra = extraLines > 0 ? ` y ${extraLines} producto${extraLines === 1 ? '' : 's'} más` : '';
  return `${totalUnits} unidad${totalUnits === 1 ? '' : 'es'}: ${firstTitle}${extra}`;
}

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

  /**
   * Registers a new `estandar` (standard catalog, self-service) order — the customer-facing
   * counterpart to `AdminOrdersMockService.registerPersonalizedOrder()`, following that method's
   * exact "build a view model, push it into the signal so it's immediately visible wherever that
   * signal is read" structure. Called by `features/checkout/components/order-review-step/
   * order-review-step.component.ts` after the visitor confirms their order on the final checkout
   * review step.
   *
   * `customerInfo`/`deliveryInfo` are typed STRUCTURALLY here (an inline shape matching
   * `CustomerInfoFormValue`/`DeliveryInfoFormValue`, `features/checkout/models/
   * checkout-form.model.ts`) rather than by importing those types directly — `features/account/`
   * is a foundational domain that predates and is depended on by `features/checkout/`
   * (`OrderStatus`/`OrderKind` already flow the other direction, account -> admin); this method
   * accepts the checkout feature's form values without account depending back on checkout.
   *
   * INITIAL STATUS IS `pendiente`, NOT `confirmado` — this is the key distinction from
   * `registerPersonalizedOrder()`'s `confirmado` initial status. A personalized order is only ever
   * registered AFTER an advisor has already attested the external payment was received, so nothing
   * is left pending at registration time. A standard catalog order created by THIS method, by
   * contrast, is created at the moment the visitor submits the checkout form — CLAUDE.md's
   * payment-gateway step (checkout flow step 4) is explicitly NOT implemented by this frontend-only
   * mock (no payment gateway is chosen yet), so this order has not been paid for by any mechanism
   * this application can attest to. `pendiente` honestly represents "registered, not yet
   * confirmed" — never `confirmado`, and no status-history note here ever claims a payment was
   * processed, charged, or accepted (contrast the seeded `CUSTOMER_ORDERS_SEED` notes'
   * "tras el pago en línea" wording, which predates this method and is not touched by it).
   *
   * Fails deterministically when `deliveryInfo.address` contains `MOCK_ORDER_SUBMIT_FAILURE_MARKER`
   * (see that constant's doc comment) so the checkout UI's error/retry path can be previewed
   * without a real backend.
   */
  createStandardOrder(
    items: readonly CartItem[],
    customerInfo: { readonly fullName: string; readonly email: string; readonly phone: string },
    deliveryInfo: { readonly address: string; readonly district: string; readonly notes: string },
  ): Observable<OrderDetailViewModel> {
    void customerInfo; // Never persisted beyond this mock's in-memory order record; kept as an
    // explicit parameter (rather than dropped) so a future real integration has an obvious place
    // to forward it to a real backend DTO.
    if (deliveryInfo.address.includes(MOCK_ORDER_SUBMIT_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() => throwError(() => new OrdersMockError('Mock standard order creation failure'))),
      );
    }
    const now = new Date();
    const created: OrderDetailViewModel = {
      id: `PED-MOCK-${nextStandardOrderSequence++}`,
      placedAt: now,
      status: 'pendiente',
      kind: 'estandar',
      summary: buildStandardOrderSummary(items),
      statusHistory: [
        {
          previousStatus: null,
          newStatus: 'pendiente',
          changedAt: now,
          responsible: 'Sistema',
          note: 'Pedido registrado. Pendiente de confirmación.',
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
