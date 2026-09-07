import { Injectable, signal } from '@angular/core';
import { OrderStatus } from '../../account/models/order.model';
import { CustomerInfoFormValue, DeliveryInfoFormValue } from '../models/checkout-form.model';

/** Non-sensitive reference to a just-placed order — only an id and its (mock) initial status, set
 * once by `OrderReviewStepComponent` right after a successful `createStandardOrder(...)` call and
 * read by both the confirmation page and its route guard
 * (`../guards/checkout-confirmation.guard.ts`). Never carries customer/delivery data (see that
 * guard/page's own doc comments on why an order id alone is not sensitive). */
export interface PlacedOrderRef {
  readonly id: string;
  readonly status: OrderStatus;
}

/**
 * Single source of truth for the IN-PROGRESS checkout form data (customer info, delivery info)
 * across the multi-step `/checkout` flow, mirroring `CartStateService`'s own "one place this
 * state lives" pattern (`features/cart/services/cart-state.service.ts`). No step component holds
 * its own disconnected copy of this data — every step reads its initial values from here and
 * writes back here before advancing, so navigating forward AND backward between steps never loses
 * what the visitor already typed.
 *
 * Plain Angular signals, `providedIn: 'root'` — no NgRx, same convention as every other stateful
 * service in this codebase. Purely in-memory: never touches `localStorage`/`sessionStorage` and
 * never logs any field (this data is customer-identifying/delivery-identifying — see
 * `docs/reviews/checkout-frontend.md`).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutStateService {
  private readonly customerInfoState = signal<CustomerInfoFormValue | null>(null);
  private readonly deliveryInfoState = signal<DeliveryInfoFormValue | null>(null);
  private readonly placedOrderState = signal<PlacedOrderRef | null>(null);

  readonly customerInfo = this.customerInfoState.asReadonly();
  readonly deliveryInfo = this.deliveryInfoState.asReadonly();
  /** Set only after a real, successful mock order-creation response — see
   * `../guards/checkout-confirmation.guard.ts`, which uses this to decide whether
   * `/checkout/confirmacion` is currently reachable. */
  readonly placedOrder = this.placedOrderState.asReadonly();

  setCustomerInfo(value: CustomerInfoFormValue): void {
    this.customerInfoState.set(value);
  }

  setDeliveryInfo(value: DeliveryInfoFormValue): void {
    this.deliveryInfoState.set(value);
  }

  setPlacedOrder(order: PlacedOrderRef): void {
    this.placedOrderState.set(order);
  }
}
