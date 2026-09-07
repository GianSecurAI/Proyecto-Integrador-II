import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { describeOrderStatus } from '../../../account/models/order.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * `/checkout/confirmacion` — reached only right after a successful (mock) order submission, see
 * `../../guards/checkout-confirmation.guard.ts`. Shows the new order's id, its current status
 * (`pendiente`, via the SAME `describeOrderStatus`/`app-status-badge` pair used everywhere else
 * order status is shown — `features/account/models/order.model.ts` — never an invented badge
 * style) and an honest "what happens next" message.
 *
 * NO PAYMENT-PROCESSED LANGUAGE ANYWHERE ON THIS PAGE — CLAUDE.md's checkout flow's payment-
 * gateway step (step 4) is explicitly not implemented; the copy below describes the order as
 * registered / pending confirmation, consistent with `CustomerOrdersMockService.
 * createStandardOrder(...)`'s own `pendiente` status-history note.
 *
 * Links to the EXISTING public order-tracking page (`/track-order`) rather than building a second
 * tracking view, passing the order id as a `?orderId=` query param (a non-secret identifier, not
 * the kind of sensitive data the "avoid sensitive data in URL/query parameters" rule warns
 * against) — `TrackOrderPage`'s constructor pre-fills its search field from that param when
 * present.
 */
@Component({
  selector: 'app-checkout-confirmation-page',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent],
  templateUrl: './checkout-confirmation.page.html',
  styleUrl: './checkout-confirmation.page.scss',
})
export class CheckoutConfirmationPage {
  private readonly checkoutState = inject(CheckoutStateService);

  readonly placedOrder = this.checkoutState.placedOrder;
  readonly badge = computed(() => {
    const order = this.placedOrder();
    return order ? describeOrderStatus(order.status) : null;
  });
}
