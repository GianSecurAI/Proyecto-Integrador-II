import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { CATALOG_CATEGORY_LABELS, CatalogCategory } from '../../../catalog/models/catalog-filters.model';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import {
  AdminProductViewModel,
  EMPTY_PRODUCT_FORM_VALUE,
  ProductFormValue,
  toProductFormValue,
} from '../../models/admin-product.model';
import { AdminProductsMockService, AdminProductsMockState } from '../../services/admin-products-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Admin product detail/edit screen (`/admin/products/:id`), reached from
 * `AdminProductListPage`. Same requirement grounding as the list page (RF-07/HU06). Follows the
 * exact same "view mode by default, `Editar` button toggles to an in-place reactive edit form,
 * `Guardar`/`Cancelar` in edit mode" pattern already established by
 * `features/account/pages/profile/profile.page.ts` — the direct precedent for this screen's
 * interaction model, cited here rather than inventing a new one.
 *
 * View mode shows every field read-only, including the availability badge. Availability itself is
 * NEVER edited from this page — it stays a separate, dedicated control with its own
 * confirmation-gated service method (`AdminProductsMockService.setAvailability`), triggered only
 * from `AdminProductListPage`'s row action (see that page's doc comment) — no second confirm
 * dialog trigger is invented here.
 *
 * Loading/error/not-found states mirror `OrderDetailPage`'s conventions exactly: `:id` is read
 * reactively from `route.paramMap` (not just once at construction) so navigating between two
 * products while this route is active re-fetches; an unknown id is a REAL not-found state, and
 * `?mockState=error` simulates a generic fetch failure instead.
 */
@Component({
  selector: 'app-admin-product-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    AdminProductFormComponent,
  ],
  templateUrl: './admin-product-detail.page.html',
  styleUrl: './admin-product-detail.page.scss',
})
export class AdminProductDetailPage {
  private readonly productsService = inject(AdminProductsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly product = signal<AdminProductViewModel | null>(null);
  readonly editing = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly categoryLabels = CATALOG_CATEGORY_LABELS;

  readonly formInitialValue = computed<ProductFormValue>(() => {
    const current = this.product();
    return current ? toProductFormValue(current) : EMPTY_PRODUCT_FORM_VALUE;
  });

  private currentId = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(params.get('id') ?? '');
    });
  }

  retry(): void {
    this.load(this.currentId);
  }

  startEditing(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.editing.set(true);
  }

  cancelEditing(): void {
    if (this.submitting()) return;
    this.errorMessage.set(null);
    this.editing.set(false);
  }

  /** See `AdminProductListPage.categoryLabel()`'s doc comment for why this narrowing cast is
   * needed instead of an unchecked template index. */
  categoryLabel(category: string): string {
    return this.categoryLabels[category as CatalogCategory] ?? category;
  }

  save(value: ProductFormValue): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.productsService
      .updateProduct(this.currentId, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.editing.set(false);
          this.product.set(updated);
          this.successMessage.set('El producto se actualizó correctamente.');
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('No pudimos guardar los cambios. Inténtalo de nuevo más tarde.');
        },
      });
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    const mockState: AdminProductsMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.editing.set(false);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.productsService
      .getProductById(id, mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
          this.status.set('loaded');
        },
        error: () => {
          this.product.set(null);
          this.status.set(mockState === 'error' ? 'error' : 'not-found');
        },
      });
  }
}
