import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { PRODUCT_DETAILS } from '../../mocks/product-details.mock';

/** RF-07/RF-08, explicit Product Owner visual-only scope. Figma Producto 2:906.
 * Mocks are isolated; no REST contract, pricing engine, cart, payment or quotation is defined.
 */
@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [RouterLink, ProductGalleryComponent, ProductCardComponent, EmptyStateComponent],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly detail = computed(() =>
    PRODUCT_DETAILS.find((item) => item.product.id === this.params().get('id')),
  );
  private readonly action = signal<{ id: string; kind: 'buy' | 'basket' } | null>(null);
  readonly actionMessage = computed(() => {
    const action = this.action();
    if (!action || action.id !== this.detail()?.product.id) return '';
    return action.kind === 'buy'
      ? 'Vista de demostración. La compra todavía no está disponible.'
      : 'Vista de demostración. La cesta todavía no está disponible.';
  });

  previewAction(kind: 'buy' | 'basket'): void {
    const detail = this.detail();
    if (detail) this.action.set({ id: detail.product.id, kind });
  }
}
