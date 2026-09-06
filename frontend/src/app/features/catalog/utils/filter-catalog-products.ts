import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CatalogFilters } from '../models/catalog-filters.model';

/**
 * Pure, local narrowing of an already-loaded product list — a UX convenience, not a business
 * rule (Constitution Principle III): it never decides price, stock, or eligibility, only which
 * already-fetched products are currently displayed. `CatalogPage` is the single caller (via a
 * `computed()`), so the toolbar's quick category pills and the sidebar's full filter panel both
 * drive this one function instead of two divergent filtering implementations.
 *
 * "On sale" is derived here, not stored as a separate field: a product is on sale iff
 * `compareAtPrice` is set and higher than `price` (see `CatalogProduct` doc-comment).
 */
export function filterCatalogProducts(
  products: CatalogProduct[],
  filters: CatalogFilters,
): CatalogProduct[] {
  const query = filters.query.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.category !== 'todo' && product.category !== filters.category) {
      return false;
    }
    if (filters.onSaleOnly && !isOnSale(product)) {
      return false;
    }
    if (filters.personalizableOnly && !product.personalizable) {
      return false;
    }
    if (filters.minPrice !== null && product.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== null && product.price > filters.maxPrice) {
      return false;
    }
    if (query && !product.title.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

function isOnSale(product: CatalogProduct): boolean {
  return product.compareAtPrice != null && product.compareAtPrice > product.price;
}
