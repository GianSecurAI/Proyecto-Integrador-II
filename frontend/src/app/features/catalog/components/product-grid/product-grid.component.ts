import { Component, input, output } from '@angular/core';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';

export type CatalogLoadStatus = 'loading' | 'loaded' | 'error';

/**
 * Grid of `ProductCardComponent` (Figma node 2:96) plus the loading/empty/error state
 * orchestration for the async product fetch. Purely presentational: `CatalogPage` owns the
 * actual `CatalogService` subscription and filtering; this component only renders whatever
 * `status`/`products` it's given and reports a `retry` request upward — it never decides on its
 * own whether a retry is safe (Constitution Prohibited Practice #5), same convention as
 * `ErrorStateComponent` itself.
 *
 * The empty state is reachable for real (not simulated): it renders whenever `status` is
 * `'loaded'` and the already-filtered `products` list is empty — e.g. an active filter
 * combination matches nothing.
 */
@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [
    ProductCardComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonComponent,
  ],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
})
export class ProductGridComponent {
  readonly status = input.required<CatalogLoadStatus>();
  readonly products = input.required<CatalogProduct[]>();

  readonly retry = output<void>();

  onRetry(): void {
    this.retry.emit();
  }
}
