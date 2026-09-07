import { Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CartItemComponent } from '../../../cart/components/cart-item/cart-item.component';
import { CartStateService } from '../../../cart/services/cart-state.service';

/**
 * Checkout step 1 of 4 — cart review. Reuses `CartStateService`/`CartItemComponent` DIRECTLY
 * (same line-item rendering, quantity stepper and remove action as `features/cart/pages/cart/
 * cart.page.ts`) rather than forking a read-only copy: the checkout flow is still the same cart,
 * so letting the visitor adjust quantities here is the same real behavior the cart page already
 * offers, not a new business rule invented by this component.
 *
 * If the cart becomes empty WHILE this step is showing (e.g. the visitor removes every line), the
 * step falls back to the cart page's own empty-state copy/CTA rather than inventing new wording,
 * and the "Continuar" action is not rendered — this mirrors `features/cart/pages/cart/
 * cart.page.html`'s empty-state branch. The initial "cart is empty, don't let checkout proceed at
 * all" case is handled one level up, by `../../guards/checkout-cart-not-empty.guard.ts` on the
 * `/checkout` route itself.
 *
 * PRICING/TOTALS ARE PRESENTATION-ONLY — see `CartStateService.subtotal`'s doc comment; this
 * component never recomputes or overrides that.
 */
@Component({
  selector: 'app-checkout-cart-review-step',
  standalone: true,
  imports: [RouterLink, ButtonComponent, EmptyStateComponent, CartItemComponent],
  templateUrl: './cart-review-step.component.html',
  styleUrl: './cart-review-step.component.scss',
})
export class CartReviewStepComponent {
  private readonly cart = inject(CartStateService);

  readonly items = this.cart.items;
  readonly isEmpty = this.cart.isEmpty;
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;

  readonly next = output<void>();

  onQuantityChange(event: { productId: string; quantity: number }): void {
    this.cart.setQuantity(event.productId, event.quantity);
  }

  removeItem(productId: string): void {
    this.cart.removeItem(productId);
  }

  goNext(): void {
    if (this.isEmpty()) return;
    this.next.emit();
  }
}
