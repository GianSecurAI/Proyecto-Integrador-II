import { Injectable, signal } from '@angular/core';
import { IdempotencyAttempt } from '../../../core/http/idempotency-attempt';
import { CustomerInfoFormValue, DeliveryInfoFormValue } from '../models/checkout-form.model';

/**
 * Single source of truth for the IN-PROGRESS checkout form data (customer info, delivery info)
 * across the multi-step `/checkout` flow, the id of the checkout awaiting payment (for the
 * "pago pendiente" banner) and the per-attempt `Idempotency-Key`. Plain signals, `providedIn: 'root'`; purely in-memory (never storage, never
 * logged — this data is customer-identifying).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutStateService {
  private readonly customerInfoState = signal<CustomerInfoFormValue | null>(null);
  private readonly deliveryInfoState = signal<DeliveryInfoFormValue | null>(null);
  private readonly pendingCheckoutIdState = signal<string | null>(null);

  private readonly attempt = new IdempotencyAttempt();

  readonly customerInfo = this.customerInfoState.asReadonly();
  readonly deliveryInfo = this.deliveryInfoState.asReadonly();
  /** Id of the checkout the backend created and that is not known to be finished yet. In-memory
   * only (lost on reload; there is no "list my checkouts" endpoint). Drives a banner that links
   * to the payment status page. */
  readonly pendingCheckoutId = this.pendingCheckoutIdState.asReadonly();

  setCustomerInfo(value: CustomerInfoFormValue): void {
    this.customerInfoState.set(value);
  }

  setDeliveryInfo(value: DeliveryInfoFormValue): void {
    this.deliveryInfoState.set(value);
  }

  setPendingCheckoutId(checkoutId: string | null): void {
    this.pendingCheckoutIdState.set(checkoutId);
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

  /** Forgets the typed customer/delivery data but KEEPS the attempt key: re-submitting the same
   * cart and data right after a successful creation replays the same checkout instead of opening
   * a second one. */
  clearFormData(): void {
    this.customerInfoState.set(null);
    this.deliveryInfoState.set(null);
  }

  /** Forgets the in-progress form data and attempt (when the checkout finished or the session ended). */
  resetForm(): void {
    this.pendingCheckoutIdState.set(null);
    this.customerInfoState.set(null);
    this.deliveryInfoState.set(null);
    this.attempt.reset();
  }
}
