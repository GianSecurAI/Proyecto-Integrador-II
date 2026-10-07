import { Component, computed, input } from '@angular/core';
import { describeCheckoutStatus } from '../../../../shared/models/wire-enums';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { CheckoutDto } from '../../models/checkout.model';

/** Read-only summary of a checkout exactly as the server returned it (amount, reference, lines,
 * status). Nothing is recomputed on the client. */
@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './checkout-summary.component.html',
  styleUrl: './checkout-summary.component.scss',
})
export class CheckoutSummaryComponent {
  readonly checkout = input.required<CheckoutDto>();
  readonly badge = computed(() => describeCheckoutStatus(this.checkout().status));
}
