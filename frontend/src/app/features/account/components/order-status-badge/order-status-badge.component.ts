import { Component, computed, input } from '@angular/core';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { OrderStatus, describeOrderStatus } from '../../models/order.model';

/**
 * Thin, order-domain-specific wrapper around the generic `StatusBadgeComponent`
 * (`shared/ui/status-badge/`). Kept under `features/account/components/` rather than
 * `shared/ui/` because the label + tone mapping (`describeOrderStatus`, `../../models/order.model.ts`)
 * is order-vocabulary-specific and carries the RF-13 "not final" ASSUMPTION disclaimer — putting
 * that mapping in `shared/` would make an unconfirmed status catalog look like a stable,
 * cross-feature contract. The generic badge shell itself stays in `shared/ui/` so a future
 * incidents/quotations screen can reuse it with its own vocabulary later.
 */
@Component({
  selector: 'app-order-status-badge',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './order-status-badge.component.html',
})
export class OrderStatusBadgeComponent {
  readonly status = input.required<OrderStatus>();
  readonly badge = computed(() => describeOrderStatus(this.status()));
}
