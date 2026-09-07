/**
 * Local, checkout-only FORM models — deliberately NOT persistence/ViewModel types, same
 * "form model independent from persistence/view model" discipline already established by
 * `RegisterFormValue` (`features/auth/pages/register/register.page.ts`) and
 * `EditableCustomerProfileFields`/`ProfileFormValue`-style types
 * (`features/account/pages/profile/profile.page.ts`). Both interfaces below are consumed only by
 * this feature's own step components and by
 * `CustomerOrdersMockService.createStandardOrder(...)` (`features/account/services/
 * customer-orders-mock.service.ts`, which accepts them structurally rather than importing these
 * types directly — see that method's doc comment for why).
 *
 * Field list is intentionally minimal — CLAUDE.md's standard-catalog checkout flow only requires
 * enough information to register and ship an order; no field beyond what's listed here is
 * collected (no card data of any kind, ever — see the checkout feature's other files and
 * `docs/reviews/checkout-frontend.md`).
 */

/** ASSUMPTION (ungrounded in a specific requirement id — ordinary checkout contact-info fields,
 * flagged per this codebase's "assumption, not yet approved" disclaimer convention). Phone reuses
 * the exact loose validation pattern already used by `RegisterFormValue.phone` in
 * `register.page.ts`, but — unlike that optional field — is REQUIRED here: a standard order needs
 * a way to reach the customer about delivery. */
export interface CustomerInfoFormValue {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}

/** ASSUMPTION — minimal Peru-appropriate shipping fields (single free-text address line, a
 * free-text "distrito", and an optional delivery-notes/reference-point field), per this feature's
 * explicit scope note: no structured multi-field address system, no Peru-districts
 * dropdown/lookup. `DireccionEnvio` itself is not yet a modeled backend entity
 * (docs/discovery/06-system-definition.md line 147) — these fields exist purely so this
 * frontend-only mock checkout has something to collect and display; a real backend integration
 * will define its own authoritative shape. */
export interface DeliveryInfoFormValue {
  readonly address: string;
  readonly district: string;
  readonly notes: string;
}
