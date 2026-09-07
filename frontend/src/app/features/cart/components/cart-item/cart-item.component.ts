import { Component, computed, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { CartItem } from '../../models/cart-item.model';

/**
 * One cart row: placeholder image (see `shared/ui/product-card`'s doc comment — this project has
 * no real product photography, same reasoning applies here), title, category/subcategory (NOT
 * "Color"/"Material" — `CatalogProduct`/`CartItem` have no such fields, see `CartItem`'s doc
 * comment), unit price, a quantity stepper, a remove action, and the line subtotal
 * (`unitPrice * quantity`, presentation-only — see `CartStateService`'s doc comment).
 *
 * Purely presentational: it never mutates `CartStateService` directly (Constitution Prohibited
 * Practice #5 — no business/state logic in a component beyond emitting intent). The decrement
 * button is disabled at quantity 1, forcing an explicit "Quitar" action instead of silently
 * zeroing a line out via the stepper.
 */
@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './cart-item.component.html',
  styleUrl: './cart-item.component.scss',
})
export class CartItemComponent {
  readonly item = input.required<CartItem>();

  readonly quantityChange = output<{ productId: string; quantity: number }>();
  readonly remove = output<string>();

  /** Presentation-only line subtotal — see `CartStateService`'s doc comment on why totals here
   * are never authoritative. */
  readonly lineSubtotal = computed(() => this.item().unitPrice * this.item().quantity);

  increment(): void {
    const current = this.item();
    this.quantityChange.emit({ productId: current.productId, quantity: current.quantity + 1 });
  }

  decrement(): void {
    const current = this.item();
    if (current.quantity <= 1) return;
    this.quantityChange.emit({ productId: current.productId, quantity: current.quantity - 1 });
  }

  removeItem(): void {
    this.remove.emit(this.item().productId);
  }
}
