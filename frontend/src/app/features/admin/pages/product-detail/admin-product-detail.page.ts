import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorCode, httpStatus } from '../../../../core/models/api-error.model';
import { categoryLabel } from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import {
  AdminProductViewModel,
  EMPTY_PRODUCT_FORM_VALUE,
  ProductFormValue,
  toProductFormValue,
} from '../../models/admin-product.model';
import { AdminProductsService } from '../../services/admin-products.service';

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
 * confirmation-gated service method (`AdminProductsService.setAvailability` (PATCH /api/admin/products/{id}/availability)), triggered only
 * from `AdminProductListPage`'s row action (see that page's doc comment) — no second confirm
 * dialog trigger is invented here.
 *
 * Loading/error/not-found states mirror `OrderDetailPage`'s conventions exactly: `:id` is read
 * reactively from `route.paramMap` (not just once at construction) so navigating between two
 * products while this route is active re-fetches; a 404 (or non-numeric id) is the
 * not-found state and other failures show a retry. Backed by `GET`/`PUT /api/admin/products/{id}`.
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
  private readonly productsService = inject(AdminProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly product = signal<AdminProductViewModel | null>(null);
  readonly editing = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly categoryLabel = categoryLabel;
  private readonly form = viewChild(AdminProductFormComponent);

  readonly formInitialValue = computed<ProductFormValue>(() => {
    const current = this.product();
    return current ? toProductFormValue(current) : EMPTY_PRODUCT_FORM_VALUE;
  });

  private currentId: number | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('id') ?? '';
      this.load(/^\d+$/.test(raw) ? Number(raw) : null);
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
  save(value: ProductFormValue): void {
    if (this.submitting() || this.currentId === null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.productsService
      .update(this.currentId, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.editing.set(false);
          this.product.set(updated);
          this.successMessage.set('El producto se actualizó correctamente.');
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (apiErrorCode(err) === 'VALIDATION_FAILED') {
            // Field messages go next to the matching controls; anything unmatched is listed here.
            const unmatched = this.form()?.applyServerErrors(err) ?? [];
            this.errorMessage.set(
              unmatched.length > 0
                ? `El servidor rechazó los datos: ${unmatched.join('; ')}`
                : 'Revisa los campos marcados e inténtalo de nuevo.',
            );
          } else if (httpStatus(err) === 404) {
            this.errorMessage.set('El producto ya no existe.');
          } else {
            this.errorMessage.set('No pudimos guardar los cambios. Inténtalo de nuevo más tarde.');
          }
        },
      });
  }

  private load(id: number | null): void {
    this.currentId = id;
    if (id === null) {
      this.status.set('not-found');
      return;
    }
    this.status.set('loading');
    this.editing.set(false);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.productsService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
          this.status.set('loaded');
        },
        error: (err: unknown) => {
          this.product.set(null);
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
