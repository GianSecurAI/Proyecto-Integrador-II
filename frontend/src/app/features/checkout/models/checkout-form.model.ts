/**
 * Local, checkout-only FORM models — deliberately NOT wire/ViewModel types. The wire request is
 * built from them (plus the cart) by `buildPlaceOrderRequest`
 * (`../services/standard-orders.service.ts`); the backend re-validates every field
 * (`PlaceOrderRequestDto`), so these checks are UX only.
 *
 * No card data of any kind is ever collected (there is no payment step, PD-ORD-01).
 */

/** Contact for delivery questions (`contact.fullName`, `contact.phone`). The customer's EMAIL is
 * not part of the order request: the account email comes from the session and is shown read-only. */
export interface CustomerInfoFormValue {
  readonly fullName: string;
  readonly phone: string;
}

/** Delivery fields (`delivery.address`, `delivery.district`, optional `delivery.notes`). */
export interface DeliveryInfoFormValue {
  readonly address: string;
  readonly district: string;
  readonly notes: string;
}

/** Backend limits (`OrderRules`) mirrored for UX validation. */
export const CHECKOUT_LIMITS = {
  fullName: 160,
  phoneRegex: /^[0-9+\-\s()]{6,20}$/,
  address: 200,
  district: 80,
  notes: 300,
} as const;
