import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { CatalogFiltersComponent } from '../../components/catalog-filters/catalog-filters.component';
import { CatalogToolbarComponent } from '../../components/catalog-toolbar/catalog-toolbar.component';
import {
  CatalogLoadStatus,
  ProductGridComponent,
} from '../../components/product-grid/product-grid.component';
import { CatalogFilters, defaultCatalogFilters } from '../../models/catalog-filters.model';
import { CatalogService } from '../../services/catalog.service';

/** Delay before a typed search / price change is sent to the server. */
export const CATALOG_SEARCH_DEBOUNCE_MS = 300;

/**
 * Catalog page ("Todos los productos"), RF-07/RF-08, backed by `GET /api/catalog/products`.
 *
 * Owns the one `CatalogFilters` signal shared by the toolbar's category pills and the sidebar
 * panel, the current page index, and the single in-flight request. Filtering, sorting, search
 * and paging are SERVER-side: every change re-queries the backend (text/price changes are
 * debounced; category/sort/page changes go out immediately). No cart/checkout logic besides the
 * per-card "add to cart" (CLAUDE.md purchasing flows) and no personalised-order action here.
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
  /** 0-based, as the backend counts. */
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);

  /** Mobile/tablet-only collapse state for the filter sidebar (purely presentational). */
  readonly filtersOpen = signal(false);

  private request: Subscription | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  /** Re-queries the server with the current filters + page (initial load, retry, paging). */
  load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    this.request = this.catalogService.list(this.filters(), this.page()).subscribe({
      next: (result) => {
        this.products.set(result.content);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.status.set('loaded');
      },
      error: () => this.status.set('error'),
    });
  }

  onFiltersChange(patch: Partial<CatalogFilters>): void {
    this.filters.update((current) => ({ ...current, ...patch }));
    this.page.set(0);
    const debounced = 'query' in patch || 'minPrice' in patch || 'maxPrice' in patch;
    if (debounced) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.load(), CATALOG_SEARCH_DEBOUNCE_MS);
    } else {
      this.load();
    }
  }

  onQueryChange(query: string): void {
    this.onFiltersChange({ query });
  }

  onResetFilters(): void {
    this.filters.set(defaultCatalogFilters());
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  toggleFiltersOpen(): void {
    this.filtersOpen.update((open) => !open);
  }
}
