import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { httpStatus, apiErrorCode } from '../../../../core/models/api-error.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CheckoutAttemptsComponent } from '../../components/checkout-attempts/checkout-attempts.component';
import { CheckoutSummaryComponent } from '../../components/checkout-summary/checkout-summary.component';
import { PaymentProofFormComponent } from '../../components/payment-proof-form/payment-proof-form.component';
import { CheckoutDto } from '../../models/checkout.model';
import { CheckoutService } from '../../services/checkout.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { checkoutActionErrorMessage } from '../../utils/checkout-error-messages';

type LoadState = 'loading' | 'loaded' | 'error' | 'not-found' | 'missing';

/** Gentle polling period while a proof waits for the administrator. */
export const CHECKOUT_POLL_INTERVAL_MS = 30_000;

/**
 * `/checkout/confirmacion?checkoutId=` — payment and status page of ONE checkout (ADR-005,
 * FE-04). It always renders what `GET /api/checkout/{id}` says; the SPA never decides that a
 * payment succeeded:
 *
 * - `AWAITING_PAYMENT_PROOF` / `PROOF_REJECTED`: QR + amount + reference + proof upload (the
 *   rejection reason and remaining attempts are shown for a rejected proof).
 * - `PROOF_SUBMITTED`: "en verificación", manual refresh and a 30 s poll while the tab is
 *   visible (stopped on destroy and as soon as the status changes).
 * - `PAID`: the order id and tracking links; the cart is cleared ONLY now (and only if it still
 *   holds exactly what was paid, so a cart rebuilt afterwards is not wiped).
 * - `EXPIRED` / `CANCELLED`: explanation and a way to start over.
 *
 * Route: signed-in CLIENTE (`authGuard`, UX only — the API checks ownership and answers 404 for
 * anyone else's checkout).
 */
@Component({
  selector: 'app-checkout-confirmation-page',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    CardComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    CheckoutSummaryComponent,
    CheckoutAttemptsComponent,
    PaymentProofFormComponent,
  ],
  templateUrl: './checkout-confirmation.page.html',
  styleUrl: './checkout-confirmation.page.scss',
})
export class CheckoutConfirmationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly checkoutService = inject(CheckoutService);
  private readonly checkoutState = inject(CheckoutStateService);
  private readonly cart = inject(CartStateService);

  private readonly checkoutId = this.route.snapshot.queryParamMap.get('checkoutId');
  private request: Subscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  readonly loadState = signal<LoadState>('loading');
  readonly checkout = signal<CheckoutDto | null>(null);
  readonly refreshing = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly confirmingCancel = signal(false);
  readonly cancelling = signal(false);

  /** Upload form is offered only in the two states where the server accepts a new proof and
   * attempts remain (display hint; the server enforces both). */
  readonly canUpload = computed(() => {
    const c = this.checkout();
    return (
      c !== null &&
      (c.status === 'AWAITING_PAYMENT_PROOF' || c.status === 'PROOF_REJECTED') &&
      c.attemptsRemaining > 0
    );
  });
  readonly canCancel = computed(() => {
    const c = this.checkout();
    return (
      c !== null &&
      (c.status === 'AWAITING_PAYMENT_PROOF' ||
        c.status === 'PROOF_SUBMITTED' ||
        c.status === 'PROOF_REJECTED')
    );
  });

  constructor() {
    this.load(false);
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.stopPolling();
    });
  }

  retry(): void {
    this.loadState.set('loading');
    this.load(false);
  }

  /** Manual "Actualizar estado" button. */
  refresh(): void {
    this.actionError.set(null);
    this.load(true);
  }

  onUploaded(updated: CheckoutDto): void {
    this.apply(updated);
  }

  onStale(): void {
    this.load(true);
  }

  askCancel(): void {
    this.confirmingCancel.set(true);
  }

  keepCheckout(): void {
    this.confirmingCancel.set(false);
  }

  confirmCancel(): void {
    const id = this.checkoutId;
    if (!id || this.cancelling()) return;
    this.cancelling.set(true);
    this.actionError.set(null);
    this.checkoutService.cancel(id).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.confirmingCancel.set(false);
        this.apply(updated);
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.confirmingCancel.set(false);
        this.actionError.set(
          checkoutActionErrorMessage(err, 'No pudimos cancelar el pago. Inténtalo de nuevo.'),
        );
        if (apiErrorCode(err) === 'CHECKOUT_STATE_CONFLICT') this.load(true);
      },
    });
  }

  formatDate(iso: string): string {
    return this.dateFormatter.format(new Date(iso));
  }

  /** Overridable for tests: polling only runs while the tab is visible. */
  protected isTabVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }

  private load(silent: boolean): void {
    const id = this.checkoutId;
    if (!id) {
      this.loadState.set('missing');
      return;
    }
    this.request?.unsubscribe();
    if (silent) this.refreshing.set(true);
    this.request = this.checkoutService.get(id).subscribe({
      next: (checkout) => {
        this.refreshing.set(false);
        this.apply(checkout);
      },
      error: (err: unknown) => {
        this.refreshing.set(false);
        if (silent && this.checkout()) {
          this.actionError.set(
            checkoutActionErrorMessage(err, 'No pudimos actualizar el estado. Inténtalo de nuevo.'),
          );
          return;
        }
        this.loadState.set(httpStatus(err) === 404 ? 'not-found' : 'error');
      },
    });
  }

  private apply(checkout: CheckoutDto): void {
    this.checkout.set(checkout);
    this.loadState.set('loaded');
    this.confirmingCancel.set(false);

    const finished =
      checkout.status === 'PAID' || checkout.status === 'EXPIRED' || checkout.status === 'CANCELLED';
    if (finished) {
      this.checkoutState.setPendingCheckoutId(null);
      // A finished checkout must never be replayed by a later attempt with the same cart.
      this.checkoutState.resetAttempt();
    } else {
      this.checkoutState.setPendingCheckoutId(checkout.checkoutId);
    }
    // The cart is emptied ONLY once the server says the payment was approved.
    if (checkout.status === 'PAID' && this.cartHoldsExactly(checkout)) {
      this.cart.clearCart();
    }

    if (checkout.status === 'PROOF_SUBMITTED') this.startPolling();
    else this.stopPolling();
  }

  private cartHoldsExactly(checkout: CheckoutDto): boolean {
    const cartItems = this.cart.items();
    if (cartItems.length === 0 || cartItems.length !== checkout.items.length) return false;
    return checkout.items.every((line) =>
      cartItems.some((c) => c.productId === line.productId && c.quantity === line.quantity),
    );
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.isTabVisible() && !this.refreshing()) this.load(true);
    }, CHECKOUT_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}
