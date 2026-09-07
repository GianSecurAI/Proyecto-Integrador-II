import { Component, computed, signal } from '@angular/core';
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
 * clarification: purchasing flows" §"Standard catalog products", steps 3-5, EXCLUDING step 4
 * (payment gateway) — see `../../components/order-review-step/order-review-step.component.ts`'s
 * doc comment for why). Public, unguarded route EXCEPT for
 * `../../guards/checkout-cart-not-empty.guard.ts`, which redirects to `/cart` if the cart is
 * empty at the moment this route is entered — guest checkout, consistent with `/cart` itself
 * being unguarded.
 *
 * A single page walking through four steps (cart review -> customer info -> delivery info ->
 * final review) via a local `step` signal — chosen over separate sub-routes per step because
 * every step needs the SAME shared, centrally-held form data
 * (`../../state/checkout-state.service.ts`) and none of the individual steps are meaningful
 * standalone destinations a visitor would bookmark or share; a single page keeps that data flow
 * obvious without extra route plumbing. The FINAL destination after a successful submission is
 * its own distinct, separately-guarded route (`/checkout/confirmacion`,
 * `../confirmation/checkout-confirmation.page.ts`) precisely because that one IS a meaningful
 * standalone destination (its own guard, its own "not reachable without a real order" rule).
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
  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;

  readonly step = signal<CheckoutStep>('cart');
  readonly stepIndex = computed(() => STEP_ORDER.indexOf(this.step()));

  goToStep(step: CheckoutStep): void {
    this.step.set(step);
  }
}
