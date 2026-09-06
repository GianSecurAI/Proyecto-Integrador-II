import { Component, computed, inject, signal } from '@angular/core';
import { CatalogToolbarComponent } from '../../components/catalog-toolbar/catalog-toolbar.component';
import { CatalogFiltersComponent } from '../../components/catalog-filters/catalog-filters.component';
import {
  CatalogLoadStatus,
  ProductGridComponent,
} from '../../components/product-grid/product-grid.component';
import { CatalogFilters, defaultCatalogFilters } from '../../models/catalog-filters.model';
import { CatalogService } from '../../services/catalog.service';
import { filterCatalogProducts } from '../../utils/filter-catalog-products';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';

/**
 * Catalog page ("Todos los productos"): `SUPPORTED_BY_REQUIREMENTS` per
 * docs/discovery/05-figma-analysis.md §1 (RF-07/RF-08 catalog browsing), unlike the Home page
 * (a `POSSIBLE_EXTENSION`). The real domain model and REST contract are still being finalized
 * (direct Product Owner instruction, this session), so this page and every model/service under
 * `features/catalog/` are frontend ViewModels + mock data, structured so a real HTTP-backed
 * `CatalogService.getProducts()` can replace the mock one with no change to this page's shape.
 *
 * Owns the one `CatalogFilters` signal shared by the toolbar's quick category pills and the
 * sidebar's full filter panel (both write to the same `category` field via `onFiltersChange` /
 * `onCategoryChange`, so they can never disagree), and the one product-fetch subscription
 * (`loadProducts()`), reused for both the initial load and the error state's retry action.
 * Filtering itself is a pure function (`filterCatalogProducts`) so it's not duplicated between
 * the two category controls or between "initial load" and "retry".
 *
 * No cart/checkout, no pagination (05-figma-analysis's "implícita" pagination note is
 * speculative — the actual Figma node tree has no pagination component in this file), no
 * wishlist heart icon (same unconfirmed-business-function reasoning already applied to Home's
 * product cards).
 */
@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [CatalogToolbarComponent, CatalogFiltersComponent, ProductGridComponent],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
})
export class CatalogPage {
  private readonly catalogService = inject(CatalogService);

  readonly filters = signal<CatalogFilters>(defaultCatalogFilters());
  readonly status = signal<CatalogLoadStatus>('loading');
  readonly products = signal<CatalogProduct[]>([]);

  /** Mobile/tablet-only collapse state for the filter sidebar (Figma has no responsive spec for
   * this panel at all — see catalog.page.scss for the breakpoint this targets). Purely a UI
   * presentation concern, not filter state, so it's kept separate from `CatalogFilters`. */
  readonly filtersOpen = signal(false);

  readonly filteredProducts = computed(() =>
    filterCatalogProducts(this.products(), this.filters()),
  );

  constructor() {
    this.loadProducts();
  }

  loadProducts(): void {
    this.status.set('loading');
    this.catalogService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.status.set('loaded');
      },
      error: () => {
        this.status.set('error');
      },
    });
  }

  onFiltersChange(patch: Partial<CatalogFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
  }

  onQueryChange(query: string): void {
    this.onFiltersChange({ query });
  }

  onResetFilters(): void {
    this.filters.set(defaultCatalogFilters());
  }

  toggleFiltersOpen(): void {
    this.filtersOpen.update((open) => !open);
  }
}
