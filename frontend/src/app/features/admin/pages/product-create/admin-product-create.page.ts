import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { apiErrorCode } from '../../../../core/models/api-error.model';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import { EMPTY_PRODUCT_FORM_VALUE, ProductFormValue } from '../../models/admin-product.model';
import { AdminProductsService } from '../../services/admin-products.service';

/**
 * Admin "create product" screen (`/admin/products/new`), reached from `AdminProductListPage`'s
 * page-header action. Same requirement grounding as the list/detail pages (RF-07/HU06). Reuses
 * `AdminProductFormComponent` — the exact same reactive form `AdminProductDetailPage`'s edit mode
 * uses — with an empty/default starting value instead of an existing product's data.
 *
 * A new product is always created active (`available: true`) — there is no "create as inactive"
 * control in this form (see `AdminProductViewModel.available`'s doc comment); if the operator
 * needs it inactive, they deactivate it from the list right after creating it.
 *
 * On a successful create (`POST /api/admin/products`), navigates straight to the new product's detail page
 * (`/admin/products/:id`) — mirroring how a real create-and-redirect-to-detail flow would behave.
 */
@Component({
  selector: 'app-admin-product-create-page',
  standalone: true,
  imports: [RouterLink, CardComponent, AdminProductFormComponent],
  templateUrl: './admin-product-create.page.html',
  styleUrl: './admin-product-create.page.scss',
})
export class AdminProductCreatePage {
  private readonly productsService = inject(AdminProductsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly form = viewChild(AdminProductFormComponent);

  readonly initialValue = EMPTY_PRODUCT_FORM_VALUE;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  create(value: ProductFormValue): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.productsService
      .create(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          void this.router.navigate(['/admin/products', created.id]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (apiErrorCode(err) === 'VALIDATION_FAILED') {
            const unmatched = this.form()?.applyServerErrors(err) ?? [];
            this.errorMessage.set(
              unmatched.length > 0
                ? `El servidor rechazó los datos: ${unmatched.join('; ')}`
                : 'Revisa los campos marcados e inténtalo de nuevo.',
            );
          } else {
            this.errorMessage.set('No pudimos crear el producto. Inténtalo de nuevo más tarde.');
          }
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/admin/products']);
  }
}
