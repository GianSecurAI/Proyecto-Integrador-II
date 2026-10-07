import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CartReviewStepComponent } from '../../components/cart-review-step/cart-review-step.component';
import { CustomerInfoStepComponent } from '../../components/customer-info-step/customer-info-step.component';
import { DeliveryInfoStepComponent } from '../../components/delivery-info-step/delivery-info-step.component';
import { OrderReviewStepComponent } from '../../components/order-review-step/order-review-step.component';

export type CheckoutStep = 'cart' | 'customer' | 'delivery' | 'review';

const STEP_ORDER: readonly CheckoutStep[] = ['cart', 'customer', 'delivery', 'review'];
const STEP_LABELS: Record<CheckoutStep, string> = {
  cart: 'Carrito',
  customer: 'Tus datos',
  delivery: 'Entrega',
  review: 'Confirmar',
};

/**
 * `/checkout` — the standard-catalog self-service checkout entry point (CLAUDE.md's "Business
 * clarification: purchasing flows" §"Standard catalog products"; payment is a manual Yape/Plin
 * proof verified by an administrator, ADR-005). Requires a signed-in CLIENTE
 * (`authGuard`, UX only — the backend authorizes `POST /api/checkout`) and, via
 * `../../guards/checkout-cart-not-empty.guard.ts`, a non-empty cart.
 *
 * A single page walking through four steps (cart review -> customer info -> delivery info ->
 * final review) via a local `step` signal — chosen over separate sub-routes per step because
 * every step needs the SAME shared, centrally-held form data
 * (`../../state/checkout-state.service.ts`) and none of the individual steps are meaningful
 * standalone destinations a visitor would bookmark or share; a single page keeps that data flow
 * obvious without extra route plumbing. The FINAL destination after a successful submission is
 * its own distinct route (`/checkout/confirmacion?checkoutId=`,
 * `../confirmation/checkout-confirmation.page.ts`) precisely because that one IS a meaningful
 * standalone destination (bookmarkable, linked from the rejection email).
 *
 * No Figma frame exists for a checkout flow — see `docs/reviews/checkout-frontend.md` for the
 * full documented absence. This page therefore does not copy the visual language of the (existing
 * but empty-of-checkout) Figma "Carrito de compras" frame beyond this design system's existing
 * shared tokens/components (Constitution Principle XV — build with the established design system
 * when nothing specific exists to reference).
 */
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [
    CartReviewStepComponent,
    CustomerInfoStepComponent,
    DeliveryInfoStepComponent,
    OrderReviewStepComponent,
  ],
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.scss',
})
export class CheckoutPage {
  private readonly cart = inject(CartStateService);

  constructor() {
    // Entering checkout re-checks the carted products against the server (ADR-cart-state
    // follow-up 4): fresh prices, "no longer available" lines, "prices updated" notice.
    this.cart.revalidate().pipe(takeUntilDestroyed()).subscribe();
  }

  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;

  readonly step = signal<CheckoutStep>('cart');
  readonly stepIndex = computed(() => STEP_ORDER.indexOf(this.step()));

  goToStep(step: CheckoutStep): void {
    this.step.set(step);
  }
}
