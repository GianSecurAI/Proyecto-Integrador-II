import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { CartItemComponent } from '../../components/cart-item/cart-item.component';
import { CartStateService } from '../../services/cart-state.service';

/**
 * `/cart` — public, unguarded (CLAUDE.md's real-world flow is add to cart -> checkout -> pay,
 * with login only relevant at/after that point; a guest may build a cart before ever signing in).
 * Standard-catalog self-service checkout only (CLAUDE.md's "Business clarification: purchasing
 * flows") — the advisor-mediated WhatsApp custom-order flow never reaches this page.
 *
 * All state comes from `CartStateService` — this page holds no cart data of its own. "Proceder al
 * checkout" is a plain `routerLink` into `/checkout`
 * (`features/checkout/pages/checkout/checkout.page.ts`), which owns the multi-step
 * cart-review/customer-info/delivery-info/final-review flow and the real order
 * submission (`POST /api/orders`) — this page's job stops at "hand off to checkout."
 *
 * Deviations from the Figma "Carrito de compras" reference (node 2:1459), see this feature's
 * other files for the fuller reasoning:
 * - No "Color"/"Material" attribute lines (not real `CatalogProduct` fields) — category/
 *   subcategory shown instead (`CartItemComponent`).
 * - No "Shipping: FREE" claim — this project's own shipping policy
 *   (`features/legal/pages/shipping-policy/`) says shipping is calculated at checkout, and no
 *   payment gateway is chosen yet (CLAUDE.md). The summary below shows an honest
 *   "Se calcula en el checkout" note instead, and the displayed "Total" equals the subtotal.
 * - No "SSL Encrypted"/"Free returns 30 days" trust badges — unverifiable/contradicted by the
 *   real refund policy page.
 * - No product photography — same placeholder treatment as `shared/ui/product-card`.
 */
@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    CartItemComponent,
  ],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
})
export class CartPage {
  private readonly cart = inject(CartStateService);

  readonly status = this.cart.status;
  readonly items = this.cart.items;
  readonly isEmpty = this.cart.isEmpty;
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;
  readonly unavailableIds = this.cart.unavailableIds;
  readonly hasUnavailable = this.cart.hasUnavailable;
  readonly pricesUpdated = this.cart.pricesUpdated;

  constructor() {
    // Opening the cart re-checks the carted products against the server (ADR-cart-state
    // follow-up 4): refreshed prices, "no longer available" lines, "prices updated" notice.
    this.cart.revalidate().pipe(takeUntilDestroyed()).subscribe();
  }

  retryLoad(): void {
    this.cart.retryLoad();
  }

  continueWithEmptyCart(): void {
    this.cart.continueWithEmptyCart();
  }

  onQuantityChange(event: { productId: number; quantity: number }): void {
    this.cart.setQuantity(event.productId, event.quantity);
  }

  removeItem(productId: number): void {
    this.cart.removeItem(productId);
  }

  dismissPriceNotice(): void {
    this.cart.dismissPriceNotice();
  }

  clearCart(): void {
    this.cart.clearCart();
  }
}
