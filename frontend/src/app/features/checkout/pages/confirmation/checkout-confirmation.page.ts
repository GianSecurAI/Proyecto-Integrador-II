import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { describeOrderStatus } from '../../../account/models/order.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * `/checkout/confirmacion` — reached only right after the backend CONFIRMED the order
 * (`POST /api/orders` answered 201, or 200 for an idempotent replay); see
 * `../../guards/checkout-confirmation.guard.ts`. Everything shown comes from that response: the
 * order id, server-assigned status (`CONFIRMADO`), placement time, items with server prices, the
 * server-computed total and the delivery data — nothing is recomputed client-side.
 *
 * NO PAYMENT-PROCESSED LANGUAGE: the backend creates orders without a payment step (PD-ORD-01),
 * so the copy says the order was registered and is pending confirmation.
 *
 * Links go to the customer's own order detail (`/account/orders/:id`) and the owner-only tracking
 * lookup (`/track-order`, pre-filled via `?orderId=`; there is no public tracking endpoint).
 */
@Component({
  selector: 'app-checkout-confirmation-page',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, CardComponent],
  templateUrl: './checkout-confirmation.page.html',
  styleUrl: './checkout-confirmation.page.scss',
})
export class CheckoutConfirmationPage {
  private readonly checkoutState = inject(CheckoutStateService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly placedOrder = this.checkoutState.placedOrder;
  readonly badge = computed(() => {
    const order = this.placedOrder();
    return order ? describeOrderStatus(order.status) : null;
  });

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }
}
