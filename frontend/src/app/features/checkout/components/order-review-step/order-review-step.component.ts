import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CustomerOrdersMockService } from '../../../account/services/customer-orders-mock.service';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * Checkout step 4 of 4 — final order review and submission. Read-only summary of everything (cart
 * items + quantities + prices, customer info, delivery info, order subtotal — clearly labeled as
 * a presentation-only estimate, see `CartStateService.subtotal`'s doc comment) plus the actual
 * "Confirmar y enviar pedido" submit action.
 *
 * NO PAYMENT STEP: CLAUDE.md's approved checkout flow includes a payment-gateway step (step 4 of
 * 7) that is explicitly NOT implemented here — no payment gateway provider has been chosen yet.
 * This step ends at "submit the order" and never claims a payment was processed, charged, or
 * accepted anywhere in its copy (see the template). The resulting order starts at `pendiente`
 * (see `CustomerOrdersMockService.createStandardOrder(...)`'s doc comment for the full
 * `pendiente`-vs-`confirmado` reasoning).
 *
 * Duplicate-submission prevention: the `submitting` signal disables the submit button while a mock
 * request is in flight (mirrors every other mock-service-backed form in this app, e.g.
 * `AdminRegisterPersonalizedOrderPage`), AND once a request has already SUCCEEDED this component
 * has navigated away (to `/checkout/confirmacion`) before a second click could ever reach
 * `submit()` again — there is no path back to a re-submittable review step after success.
 *
 * The cart is cleared ONLY after a successful mock response — see `submit()` — so a failed/retried
 * submission never loses the visitor's cart.
 */
@Component({
  selector: 'app-checkout-review-step',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './order-review-step.component.html',
  styleUrl: './order-review-step.component.scss',
})
export class OrderReviewStepComponent {
  private readonly cart = inject(CartStateService);
  private readonly checkoutState = inject(CheckoutStateService);
  private readonly ordersService = inject(CustomerOrdersMockService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = this.cart.items;
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;
  readonly customerInfo = this.checkoutState.customerInfo;
  readonly deliveryInfo = this.checkoutState.deliveryInfo;

  readonly back = output<void>();

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  submit(): void {
    if (this.submitting()) return;
    const customerInfo = this.customerInfo();
    const deliveryInfo = this.deliveryInfo();
    if (!customerInfo || !deliveryInfo || this.cart.isEmpty()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.ordersService
      .createStandardOrder(this.items(), customerInfo, deliveryInfo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.submitting.set(false);
          this.checkoutState.setPlacedOrder({
            id: order.id,
            status: order.status,
            placedAt: order.placedAt,
            summary: order.summary,
          });
          // Cleared ONLY after the mock order-creation call has actually succeeded — see class
          // doc comment.
          this.cart.clearCart();
          void this.router.navigateByUrl('/checkout/confirmacion');
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set(
            'No pudimos registrar tu pedido. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }

  goBack(): void {
    if (this.submitting()) return;
    this.back.emit();
  }
}
