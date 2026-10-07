import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  PRODUCT_CATEGORIES,
  ProductCategory,
  categoryLabel,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminConfirmDialogComponent } from '../../components/admin-confirm-dialog/admin-confirm-dialog.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminProductViewModel } from '../../models/admin-product.model';
import { AdminProductsService } from '../../services/admin-products.service';

type LoadStatus = 'loading' | 'loaded' | 'error';
type CategoryFilter = ProductCategory | 'todo';
type AvailabilityFilter = 'todos' | 'disponibles' | 'no-disponibles';

/** Delay before a typed search is sent to the server. */
export const PRODUCT_SEARCH_DEBOUNCE_MS = 300;

/**
 * RF-07 admin product list (ADMINISTRADOR only), backed by `GET /api/admin/products`: unlike the
 * public catalog it includes unavailable products. Search (`q`), category and availability filters
 * and paging are SERVER-side. Deactivating/activating goes through
 * `PATCH /api/admin/products/{id}/availability` (the public catalog then hides/shows the product).
 */
@Component({
  selector: 'app-admin-product-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AdminPageHeaderComponent,
    AdminDataTableComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    AdminConfirmDialogComponent,
  ],
  templateUrl: './admin-product-list.page.html',
  styleUrl: './admin-product-list.page.scss',
})
export class AdminProductListPage {
  private readonly productsService = inject(AdminProductsService);

  readonly status = signal<LoadStatus>('loading');
  readonly products = signal<AdminProductViewModel[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly search = signal('');
  readonly categoryFilter = signal<CategoryFilter>('todo');
  readonly availabilityFilter = signal<AvailabilityFilter>('todos');

  readonly categories: readonly ProductCategory[] = PRODUCT_CATEGORIES;
  readonly categoryLabel = categoryLabel;

  readonly pendingDeactivation = signal<AdminProductViewModel | null>(null);
  readonly availabilityError = signal<string | null>(null);

  private request: Subscription | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  retry(): void {
    this.load();
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), PRODUCT_SEARCH_DEBOUNCE_MS);
  }

  updateCategoryFilter(value: string): void {
    this.categoryFilter.set(value as CategoryFilter);
    this.page.set(0);
    this.load();
  }

  updateAvailabilityFilter(value: string): void {
    this.availabilityFilter.set(value as AvailabilityFilter);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  hasActiveFilters(): boolean {
    return (
      this.search().trim() !== '' ||
      this.categoryFilter() !== 'todo' ||
      this.availabilityFilter() !== 'todos'
    );
  }

  activate(product: AdminProductViewModel): void {
    this.applyAvailability(product.id, true);
  }

  requestDeactivate(product: AdminProductViewModel): void {
    this.availabilityError.set(null);
    this.pendingDeactivation.set(product);
  }

  cancelDeactivate(): void {
    this.pendingDeactivation.set(null);
  }

  confirmDeactivate(): void {
    const product = this.pendingDeactivation();
    if (!product) return;
    this.pendingDeactivation.set(null);
    this.applyAvailability(product.id, false);
  }

  private applyAvailability(id: number, available: boolean): void {
    this.availabilityError.set(null);
    this.productsService.setAvailability(id, available).subscribe({
      next: (updated) => {
        this.products.update((current) =>
          current.map((product) => (product.id === updated.id ? updated : product)),
        );
      },
      error: () => {
        this.availabilityError.set(
          'No pudimos actualizar la disponibilidad del producto. Inténtalo de nuevo más tarde.',
        );
      },
    });
  }

  private load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    const category = this.categoryFilter();
    const availability = this.availabilityFilter();
    this.request = this.productsService
      .list({
        q: this.search(),
        category: category === 'todo' ? null : category,
        available: availability === 'todos' ? null : availability === 'disponibles',
        page: this.page(),
      })
      .subscribe({
        next: (result) => {
          this.products.set(result.content);
          this.totalPages.set(result.totalPages);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
