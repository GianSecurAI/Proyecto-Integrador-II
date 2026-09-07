/**
 * A single line in the client-side shopping cart (standard catalog self-service checkout only,
 * per CLAUDE.md's "Business clarification: purchasing flows" — the advisor-mediated WhatsApp
 * custom-order flow never touches this cart).
 *
 * Deliberately a PRESENTATION SNAPSHOT captured at add-time, not a live reference back to
 * `CatalogProduct`: `unitPrice`/`title`/`category`/`subcategory` are copied from the product at
 * the moment it was added, so a later catalog price change does not silently rewrite what a
 * customer already sees in their cart. This mirrors real e-commerce behavior and is honest about
 * what the frontend actually knows.
 *
 * PRICING AUTHORITY (Constitution Principle III — frontend is never authoritative): `unitPrice`
 * here is copied from the same already-approved mock `CatalogProduct.price` used throughout the
 * app (`shared/models/catalog-product.model.ts`) — it is never user-editable, never derived from
 * a URL param, and never otherwise browser-controlled input. Even so, this value and every total
 * computed from it (`CartStateService.subtotal`/`itemCount`) are PRESENTATION values only. A real
 * checkout, when built, MUST re-request authoritative pricing from the backend at order-creation
 * time rather than trusting anything read from this cart.
 */
export interface CartItem {
  readonly productId: string;
  readonly title: string;
  readonly category: string;
  readonly subcategory: string;
  /** Price-at-add-time snapshot, in soles. See class doc comment — never trust this as a final
   * order total; it is a UX convenience value only. */
  readonly unitPrice: number;
  readonly quantity: number;
}
