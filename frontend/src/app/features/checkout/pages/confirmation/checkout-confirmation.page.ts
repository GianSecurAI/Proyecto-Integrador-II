import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { describeOrderStatus } from '../../../account/models/order.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * `/checkout/confirmacion` — reached only right after a successful (mock) order submission, see
 * `../../guards/checkout-confirmation.guard.ts`. Shows the new order's id, its current status
 * (`pendiente`, via the SAME `describeOrderStatus`/`app-status-badge` pair used everywhere else
 * order status is shown — `features/account/models/order.model.ts` — never an invented badge
 * style), when it was placed, its short (collapsed, non-itemized — see `PlacedOrderRef`'s doc
 * comment) order summary, and an honest "what happens next" message. Content is wrapped in
 * `app-card` (`shared/ui/card/`) to match the established "boxed result" convention used by
 * `order-detail.page.html`/`admin-order-detail.page.html`.
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
 *
 * Additionally, for a customer who is currently signed in as `CLIENTE` (per `SessionStateService`
 * — never trusted for authorization, only for this UI branch, same limits documented on that
 * service), also links to the existing, already-guarded `/account/orders/:id` detail page so they
 * don't have to go through the public lookup-by-id tracking flow to see their own order. Omitted
 * entirely for a guest/unauthenticated visitor (who would just bounce off `authGuard`) and for any
 * non-`CLIENTE` role (a customer order confirmation should never suggest a staff account can "view"
 * it via that customer-scoped route).
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
  private readonly session = inject(SessionStateService);

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

  /** Drives the conditional "Ver mi pedido" link — see class doc comment for why it's restricted
   * to an authenticated `CLIENTE` session. Purely a UI branch, never a displayed session/auth
   * value. */
  readonly canViewOwnOrder = computed(
    () => this.session.isAuthenticated() && this.session.currentRole() === 'CLIENTE',
  );

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }
}
