import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStateService } from '../../../features/cart/services/cart-state.service';
import { CatalogProduct } from '../../models/catalog-product.model';
import { CardComponent } from '../card/card.component';

/**
 * One product tile, shared by the Home showcase sections and the `/catalog` page. Promoted from
 * `features/home/components/product-card/` into `shared/ui/` when the Catalog feature was built
 * (docs/architecture/frontend-foundation.md) because the real Figma Catalogo cards (node
 * `2:105` et al.) are structurally identical to Home's — building a second copy would duplicate
 * the same visual pattern and filtering-adjacent markup (Constitution Principle II). Structurally
 * adapted from the repeated product-card pattern in docs/discovery/05-figma-analysis.md (nodes
 * ~1:54-1:77 for Home, ~2:105 for Catalogo), with required deviations:
 *
 * - No product photo. The Figma cards show a different company's real product photography
 *   (several are licensed third-party IP — sports team/franchise logos), which does not belong
 *   to this project. This renders a plain `--ar-color-surface-dark` placeholder box instead
 *   (that token's own comment already documents this exact use case), with `aria-hidden="true"`
 *   since it carries no content.
 * - No "VENTA" sale badge, no wishlist heart icon. Both imply unconfirmed business functions
 *   (an active discount engine, a favorites feature) per 05-figma-analysis's own
 *   business-function-suggestions list. `badge` is a purely cosmetic, optional label only —
 *   never wired to a real discount calculation here.
 * - "Ver más" navigates to the mock-backed detail route. Custom requests use the detail's
 *   dedicated WhatsApp CTA, never a cart or checkout.
 *
 * "Añadir al carrito" (added alongside "Ver más" when the standard-catalog cart was built, see
 * `features/cart/`) is the ONLY per-product-card action for the standard self-service purchase
 * path — there is deliberately no per-card "Personalizar" action (CLAUDE.md's UI-placement rule:
 * that CTA is a single, home-page-scoped section, never repeated per product). Every product
 * shown by this card uses the same standard add-to-cart flow; there is no per-product branch
 * between "standard" and "personalizable" here. Adding 1 unit is a UX convenience for the catalog
 * grid — a customer who wants a different quantity can still open the detail page first.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  private readonly cart = inject(CartStateService);

  readonly product = input.required<CatalogProduct>();

  readonly addedFeedback = signal(false);

  addToCart(): void {
    this.cart.addItem(this.product(), 1);
    this.addedFeedback.set(true);
  }
}
