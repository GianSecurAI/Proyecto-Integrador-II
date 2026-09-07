import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  CatalogCategory,
} from '../../../catalog/models/catalog-filters.model';
import { AdminConfirmDialogComponent } from '../../components/admin-confirm-dialog/admin-confirm-dialog.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminProductViewModel } from '../../models/admin-product.model';
import { AdminProductsMockService, AdminProductsMockState } from '../../services/admin-products-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * The real RF-07 ("Catálogo de productos" / HU06 "Gestionar catálogo de productos", Confirmado —
 * see `docs/discovery/01-requirements-analysis.md` line 218,
 * `docs/discovery/06-system-definition.md` lines 197-201) admin product list, replacing the
 * TEMPORARY `admin-products-placeholder.page.ts` this task retires.
 *
 * Figma has ZERO admin frames of any kind — confirmed directly via the Figma MCP (grepped the
 * full metadata dump for "admin"/"dashboard"/"sidebar"/"panel" and separately for
 * "gestionar"/"crear producto"/"editar producto"/"nuevo producto", zero matches both times);
 * `docs/discovery/05-figma-analysis.md` and `06-system-definition.md` (lines 260-264)
 * independently confirm this absence. This screen therefore reuses the existing admin design
 * system (`AdminDataTableComponent`, `AdminPageHeaderComponent`, `_tokens.scss`) per Constitution
 * Principle XV, exactly like every other admin screen already does.
 *
 * No REST contract exists for admin product management yet — `AdminProductsMockService` is an
 * isolated, frontend-only preview. `?mockState=empty`/`?mockState=error` query params let a
 * reviewer deterministically preview those states from the browser URL bar, same convention as
 * `OrderHistoryPage`. Search (by title, case-insensitive substring) and category filtering are
 * pure local narrowing of the already-fetched list — the same "local filter against loaded mock
 * data" approach as `CatalogPage`/`filterCatalogProducts` (`features/catalog/utils/`), just
 * inlined here since this list only has two, much simpler filter dimensions.
 *
 * The availability toggle is the confirm dialog's one grounded trigger: deactivating a product
 * (`available: true -> false`) is a customer-visible change worth confirming; reactivating
 * (`false -> true`) is non-destructive and applies immediately, no dialog. See
 * `AdminConfirmDialogComponent`'s doc comment.
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
  private readonly productsService = inject(AdminProductsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly products = signal<AdminProductViewModel[]>([]);

  readonly search = signal('');
  readonly categoryFilter = signal<CatalogCategory>('todo');

  readonly categories = CATALOG_CATEGORIES;
  readonly categoryLabels = CATALOG_CATEGORY_LABELS;

  /** The product currently awaiting deactivation confirmation, or `null` when the dialog is
   * closed — set by `requestDeactivate()`, cleared by `confirmDeactivate()`/`cancelDeactivate()`. */
  readonly pendingDeactivation = signal<AdminProductViewModel | null>(null);
  readonly availabilityError = signal<string | null>(null);

  private currentMockState: AdminProductsMockState = 'populated';

  readonly filteredProducts = computed(() => {
    const query = this.search().trim().toLowerCase();
    const category = this.categoryFilter();
    return this.products().filter((product) => {
      if (category !== 'todo' && product.category !== category) {
        return false;
      }
      if (query && !product.title.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const value = params.get('mockState');
      this.currentMockState = value === 'empty' || value === 'error' ? value : 'populated';
      this.load(this.currentMockState);
    });
  }

  retry(): void {
    this.load(this.currentMockState);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateCategoryFilter(value: string): void {
    this.categoryFilter.set(value as CatalogCategory);
  }

  /** `AdminProductViewModel.category` is typed as the base `CatalogProduct.category: string` (see
   * that model's doc comment) even though every seeded/created value is actually a real
   * `CatalogCategory` — this narrows for the label lookup without an unchecked template cast. */
  categoryLabel(category: string): string {
    return this.categoryLabels[category as CatalogCategory] ?? category;
  }

  /** Reactivation (`false -> true`) is non-destructive — applied immediately, no confirmation. */
  activate(product: AdminProductViewModel): void {
    this.applyAvailability(product.id, true);
  }

  /** Deactivation (`true -> false`) is customer-visible — gated behind the confirm dialog. */
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

  private applyAvailability(id: string, available: boolean): void {
    this.availabilityError.set(null);
    this.productsService
      .setAvailability(id, available)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  private load(mockState: AdminProductsMockState): void {
    this.status.set('loading');
    this.productsService
      .getProducts(mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
