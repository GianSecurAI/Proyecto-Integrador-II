import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { apiErrorCode, httpStatus, toApiError, rateLimitMessage } from '../../../../core/models/api-error.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CheckoutService, buildCheckoutRequest } from '../../services/checkout.service';

/** Spanish labels for the backend field paths that can appear in `fieldErrors`. */
const FIELD_LABELS: Record<string, string> = {
  items: 'Productos',
  'contact.fullName': 'Nombre completo',
  'contact.phone': 'Teléfono',
  'delivery.address': 'Dirección',
  'delivery.district': 'Distrito',
  'delivery.notes': 'Notas de entrega',
};

function labelFor(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  if (/^items\[\d+\]\.quantity$/.test(field)) return 'Cantidad';
  if (/^items\[\d+\]/.test(field)) return 'Producto';
  return field;
}

/**
 * Checkout step 4 of 4 — final review and creation of the checkout through `POST /api/checkout`
 * (ADR-005, FE-04). On success the customer continues to the payment page
 * (`/checkout/confirmacion?checkoutId=`) where they pay by Yape/Plin and upload the proof; the
 * ORDER only exists after an administrator approves it.
 *
 * - The request is built ONLY from `{ productId, quantity }` + delivery + contact
 *   (`buildCheckoutRequest`); prices/totals/status are never sent. The amounts shown here are
 *   informational estimates; the payment page shows the server-computed total.
 * - An `Idempotency-Key` UUID is generated per attempt (`CheckoutStateService.idempotencyKeyFor`):
 *   a retry of the SAME request replays the original checkout instead of duplicating it.
 * - The cart is NOT cleared here: it is cleared only when the checkout is PAID (status page).
 * - Backend errors are mapped: 400 VALIDATION_FAILED -> field messages, 409 PRODUCT_UNAVAILABLE ->
 *   the cart is revalidated and the unavailable lines flagged, 409 IDEMPOTENCY_KEY_REUSED -> new
 *   key + retry hint, 409 CONFLICT -> too many unpaid checkouts, 429 -> wait message, anything
 *   else generic. 401/403 are handled globally by the error interceptor.
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
  private readonly checkoutService = inject(CheckoutService);
  private readonly session = inject(SessionStateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = this.cart.items;
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;
  readonly customerInfo = this.checkoutState.customerInfo;
  readonly deliveryInfo = this.checkoutState.deliveryInfo;
  readonly accountEmail = this.session.currentEmail;

  readonly back = output<void>();

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** Field-level messages from a 400 VALIDATION_FAILED, already labelled in Spanish. */
  readonly fieldMessages = signal<string[]>([]);
  readonly canSubmit = computed(() => !this.submitting() && !this.cart.hasUnavailable());

  submit(): void {
    if (this.submitting()) return;
    const customerInfo = this.customerInfo();
    const deliveryInfo = this.deliveryInfo();
    if (!customerInfo || !deliveryInfo || this.cart.isEmpty() || this.cart.hasUnavailable()) return;

    const request = buildCheckoutRequest(this.items(), customerInfo, deliveryInfo);
    const key = this.checkoutState.idempotencyKeyFor(request);

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.fieldMessages.set([]);
    this.checkoutService
      .create(request, key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (checkout) => {
          this.submitting.set(false);
          // The cart is kept until the payment is confirmed (status page clears it on PAID).
          this.checkoutState.setPendingCheckoutId(checkout.checkoutId);
          this.checkoutState.clearFormData();
          void this.router.navigate(['/checkout/confirmacion'], {
            queryParams: { checkoutId: checkout.checkoutId },
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.showError(err);
        },
      });
  }

  goBack(): void {
    if (this.submitting()) return;
    this.back.emit();
  }

  private showError(err: unknown): void {
    const status = httpStatus(err);
    const code = apiErrorCode(err);
    if (code === 'VALIDATION_FAILED') {
      const fields = toApiError(err)?.fieldErrors ?? [];
      this.fieldMessages.set(fields.map((f) => `${labelFor(f.field)}: ${f.message}`));
      this.errorMessage.set('El servidor rechazó algunos datos. Revisa y corrige lo siguiente.');
    } else if (code === 'PRODUCT_UNAVAILABLE') {
      this.errorMessage.set(
        'Uno o más productos ya no están disponibles. Revisa tu carrito y quítalos para continuar.',
      );
      this.cart.revalidate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    } else if (code === 'IDEMPOTENCY_KEY_REUSED') {
      this.checkoutState.resetAttempt();
      this.errorMessage.set('No pudimos completar el envío. Inténtalo de nuevo.');
    } else if (code === 'CONFLICT') {
      this.errorMessage.set(
        'Tienes varios pagos pendientes. Completa o cancela alguno antes de iniciar uno nuevo.',
      );
    } else if (status === 429) {
      this.errorMessage.set(rateLimitMessage(err));
    } else if (status === 401 || status === 403) {
      // Redirect handled by the global error interceptor.
      this.errorMessage.set('Tu sesión no permite realizar esta compra.');
    } else {
      this.errorMessage.set('No pudimos iniciar tu pago. Inténtalo de nuevo más tarde.');
    }
  }
}
