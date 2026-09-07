import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { ProductGalleryComponent } from '../../components/product-gallery/product-gallery.component';
import { PRODUCT_DETAILS } from '../../mocks/product-details.mock';

/** RF-07/RF-08, explicit Product Owner visual-only scope. Figma Producto 2:906.
 * Mocks are isolated; no REST contract, pricing engine, payment or quotation is defined.
 *
 * "Añadir a la cesta" and "Comprar ahora" were wired to the real standard-catalog cart
 * (`features/cart/`, CLAUDE.md's "Business clarification: purchasing flows") once it existed —
 * both were previously demo-only stubs. "Comprar ahora" adds 1 unit AND navigates straight to
 * `/cart` in one step (a common "buy now" shortcut) since no real checkout exists yet to jump
 * into directly; "Añadir a la cesta" adds without navigating, showing inline confirmation
 * feedback instead (mirrors the previous `previewAction` feedback pattern, now backed by a real
 * action rather than a dead-end demo message).
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
  private readonly router = inject(Router);
  private readonly cart = inject(CartStateService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly detail = computed(() =>
    PRODUCT_DETAILS.find((item) => item.product.id === this.params().get('id')),
  );
  private readonly feedback = signal<{ id: string; message: string } | null>(null);
  readonly actionMessage = computed(() => {
    const feedback = this.feedback();
    if (!feedback || feedback.id !== this.detail()?.product.id) return '';
    return feedback.message;
  });

  addToCart(): void {
    const detail = this.detail();
    if (!detail) return;
    this.cart.addItem(detail.product, 1);
    this.feedback.set({ id: detail.product.id, message: 'Se añadió al carrito.' });
  }

  buyNow(): void {
    const detail = this.detail();
    if (!detail) return;
    this.cart.addItem(detail.product, 1);
    void this.router.navigateByUrl('/cart');
  }
}
