/**
 * Shape of a product shown anywhere in the storefront (Home showcase sections and the
 * `/catalog` page). Promoted out of `features/home/` into `shared/models/` when the Catalog
 * feature was built (docs/architecture/frontend-foundation.md §9/§11), because both features
 * need the exact same product-card visual pattern and data shape — see
 * `shared/ui/product-card/product-card.component.ts` for the corresponding shared component.
 *
 * Backed today only by mock data (`features/home/mocks/home-products.mock.ts`,
 * `features/catalog/mocks/catalog-products.mock.ts`) — there is no `/catalog` endpoint yet; the
 * real domain model and REST contract are still being finalized. Currency formatting (`S/`)
 * happens in the template, not baked into this data.
 */
export interface CatalogProduct {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  /** Purely decorative, optional accent label (e.g. "Nuevo"). Never a real promotion/discount
   * signal — no discount engine exists (see product-card component doc-comment). A product is
   * considered "on sale" iff `compareAtPrice` is set and lower than `price` — there is no
   * separate boolean for this, to avoid two fields that could disagree. */
  badge?: string;
  /** Whether this product can be requested as a personalized/custom order (WhatsApp advisory
   * flow per project requirements), surfaced by the Catalog page's "Solo personalizable" filter. Optional
   * because Home's mock data predates this field and every product on Home already renders the
   * "Personalizar" CTA regardless of this flag. */
  personalizable?: boolean;
}
