import { Injectable, signal } from '@angular/core';
import { IdempotencyAttempt } from '../../../core/http/idempotency-attempt';
import { OrderDetailViewModel } from '../../account/models/order.model';
import { CustomerInfoFormValue, DeliveryInfoFormValue } from '../models/checkout-form.model';

/**
 * Single source of truth for the IN-PROGRESS checkout form data (customer info, delivery info)
 * across the multi-step `/checkout` flow, plus the confirmed order and the per-attempt
 * `Idempotency-Key`. Plain signals, `providedIn: 'root'`; purely in-memory (never storage, never
 * logged — this data is customer-identifying).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutStateService {
  private readonly customerInfoState = signal<CustomerInfoFormValue | null>(null);
  private readonly deliveryInfoState = signal<DeliveryInfoFormValue | null>(null);
  private readonly placedOrderState = signal<OrderDetailViewModel | null>(null);

  private readonly attempt = new IdempotencyAttempt();

  readonly customerInfo = this.customerInfoState.asReadonly();
  readonly deliveryInfo = this.deliveryInfoState.asReadonly();
  /** The order exactly as the backend returned it after a confirmed creation (201/200). Set only
   * then; `checkoutConfirmationGuard` uses it to decide whether `/checkout/confirmacion` is
   * reachable. */
  readonly placedOrder = this.placedOrderState.asReadonly();

  setCustomerInfo(value: CustomerInfoFormValue): void {
    this.customerInfoState.set(value);
  }

  setDeliveryInfo(value: DeliveryInfoFormValue): void {
    this.deliveryInfoState.set(value);
  }

  setPlacedOrder(order: OrderDetailViewModel): void {
    this.placedOrderState.set(order);
  }

  /**
   * The `Idempotency-Key` for the current checkout attempt. The same key is reused while the
   * request body is unchanged (a retry after a network failure replays the original order), and
   * a NEW key is generated as soon as the body differs — the server answers 409
   * IDEMPOTENCY_KEY_REUSED when one key is sent with two different bodies.
   */
  idempotencyKeyFor(requestBody: unknown): string {
    return this.attempt.keyFor(requestBody);
  }

  /** Forces a fresh key (e.g. after IDEMPOTENCY_KEY_REUSED). */
  resetAttempt(): void {
    this.attempt.reset();
  }

  /** Forgets the in-progress form data and attempt (after a confirmed order or a session end). */
  resetForm(): void {
    this.customerInfoState.set(null);
    this.deliveryInfoState.set(null);
    this.attempt.reset();
  }
}
