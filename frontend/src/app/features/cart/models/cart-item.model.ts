import { ProductCategory } from '../../../shared/models/wire-enums';

/** Backend limits for one order line quantity (`OrderRules.QUANTITY_MIN/MAX`). UX mirror only —
 * the server re-validates. */
export const CART_QUANTITY_MIN = 1;
export const CART_QUANTITY_MAX = 99;

/**
 * A single line in the client-side shopping cart (standard catalog self-service checkout only,
 * per CLAUDE.md's "Business clarification: purchasing flows" — the advisor-mediated WhatsApp
 * custom-order flow never touches this cart). See `docs/decisions/ADR-cart-state.md`.
 *
 * A PRESENTATION SNAPSHOT captured at add-time (and refreshed by `CartStateService.revalidate`
 * against `GET /api/catalog/products?ids=`): `unitPrice` and everything derived from it are for
 * display only. The order request is built from `{ productId, quantity }` ONLY
 * (`features/checkout/services/standard-orders.service.ts`), so a price can never reach the
 * backend, and the server prices the order itself (Principle III).
 */
export interface CartItem {
  /** Backend numeric product id. */
  readonly productId: number;
  readonly title: string;
  readonly category: ProductCategory;
  readonly subcategory: string;
  /** Price-at-add-time snapshot, in soles. Informational only — never an order total. */
  readonly unitPrice: number;
  readonly quantity: number;
}
