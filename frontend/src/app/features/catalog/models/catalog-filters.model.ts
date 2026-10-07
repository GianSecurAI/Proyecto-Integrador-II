import { PRODUCT_CATEGORIES, ProductCategory, categoryLabel } from '../../../shared/models/wire-enums';

/** Category choice in the UI: every real backend category plus "all" (no `category` param). */
export type CatalogCategory = 'todo' | ProductCategory;

export const CATALOG_CATEGORIES: CatalogCategory[] = ['todo', ...PRODUCT_CATEGORIES];

/** Human-readable label for each category value, shared by the toolbar pills and the sidebar. */
export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  todo: 'Todo',
  LLAVERO: categoryLabel('LLAVERO'),
  PEGATINAS: categoryLabel('PEGATINAS'),
};

/** Sort options accepted by `GET /api/catalog/products?sort=` (price|title|createdAt[,asc|desc]). */
export type CatalogSort = 'createdAt,desc' | 'price,asc' | 'price,desc' | 'title,asc';

export const CATALOG_SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'createdAt,desc', label: 'Más recientes' },
  { value: 'price,asc', label: 'Precio: menor a mayor' },
  { value: 'price,desc', label: 'Precio: mayor a menor' },
  { value: 'title,asc', label: 'Nombre (A-Z)' },
];

/**
 * All catalog filter state, owned by `CatalogPage`. Every field maps 1:1 onto a backend query
 * parameter (`category`, `minPrice`, `maxPrice`, `q`, `sort`); filtering/sorting/paging are done
 * SERVER-side, never over a locally loaded list.
 */
export interface CatalogFilters {
  category: CatalogCategory;
  minPrice: number | null;
  maxPrice: number | null;
  /** Free-text search (`q`, max 100 chars server-side). */
  query: string;
  sort: CatalogSort;
}

export function defaultCatalogFilters(): CatalogFilters {
  return { category: 'todo', minPrice: null, maxPrice: null, query: '', sort: 'createdAt,desc' };
}
