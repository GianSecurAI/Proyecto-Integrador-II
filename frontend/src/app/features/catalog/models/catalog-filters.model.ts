/** The four catalog category buckets, shared by the toolbar pill row and the sidebar radio list
 * (Figma nodes 2:7 and 2:27) — a single vocabulary so both controls stay in sync against one
 * piece of state (`CatalogPage`), instead of duplicating the category list in two components. */
export type CatalogCategory = 'todo' | 'descarga-digital' | 'llavero' | 'pegatinas';

/** Human-readable label for each category value, used by both the toolbar pills and the
 * sidebar radio list so the copy never drifts between the two. */
export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  todo: 'Todo',
  'descarga-digital': 'Descarga digital',
  llavero: 'Llavero',
  pegatinas: 'Pegatinas',
};

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  'todo',
  'descarga-digital',
  'llavero',
  'pegatinas',
];

/**
 * All catalog filter/search state, owned by `CatalogPage` and passed down to the toolbar and
 * sidebar filter panel. Filtering is purely local/reactive against the already-loaded mock
 * product list (Figma's filter panel has no "aplicar" button in the real file, so every change
 * re-filters immediately — see catalog.page.ts).
 */
export interface CatalogFilters {
  category: CatalogCategory;
  onSaleOnly: boolean;
  personalizableOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  /** Catalog-toolbar text search (Figma's header search box is out of scope here — see
   * catalog-toolbar.component.ts doc-comment); case-insensitive substring match on title. */
  query: string;
}

export function defaultCatalogFilters(): CatalogFilters {
  return {
    category: 'todo',
    onSaleOnly: false,
    personalizableOnly: false,
    minPrice: null,
    maxPrice: null,
    query: '',
  };
}
