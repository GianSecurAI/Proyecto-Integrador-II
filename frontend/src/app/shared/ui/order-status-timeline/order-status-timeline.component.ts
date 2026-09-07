import { Component, computed, input } from '@angular/core';
// Deliberate exception to "shared/ui never imports from features/": this task's own brief
// (RF-12 order-tracking screen) explicitly requires reusing the ONE existing order-status
// vocabulary (`OrderStatus`, `describeOrderStatus`) rather than inventing a second, competing
// one here — see `order.model.ts`'s "ASSUMPTION — order status vocabulary" doc comment. The
// alternative (duplicating the six-value enum and its Spanish labels in `shared/`) would create
// exactly the "two fake databases for the same concept" problem CLAUDE.md warns against. This
// component still contains zero business/transition logic (Prohibited Practice #5) — it only
// arranges an already-decided `status` into a presentational step list.
import {
  OrderStatus,
  describeOrderStatus,
} from '../../../features/account/models/order.model';

export type OrderStatusStepState = 'done' | 'current' | 'upcoming';

export interface OrderStatusStepViewModel {
  readonly status: OrderStatus;
  readonly label: string;
  readonly state: OrderStatusStepState;
}

/** Happy-path step order. `cancelado` is intentionally excluded — it is a terminal, off-path
 * state handled separately (see `isCancelled`), not a further step along this sequence. */
const HAPPY_PATH_STEPS: readonly OrderStatus[] = [
  'pendiente',
  'confirmado',
  'en_produccion',
  'enviado',
  'entregado',
];

/**
 * Shared, order-domain visual status timeline: an ordered step list (Pendiente → Confirmado →
 * En producción → Enviado → Entregado) with the current position highlighted. Used by both the
 * public order-tracking page (`features/order-tracking/pages/track-order/`) and the
 * authenticated order-detail page (`features/account/pages/order-detail/`) so both screens that
 * show order-status progression render it identically. Distinct from the plain, append-only
 * status-*history* list (previous → new, date, responsible, note) still rendered separately by
 * both pages — this component only shows *where the order currently sits*, not the full change
 * log.
 *
 * `cancelado` gets a distinct visual treatment (a dedicated notice, no step marked
 * done/current) since it is a terminal state reached OFF the happy path, not a sixth step
 * further along it.
 */
@Component({
  selector: 'app-order-status-timeline',
  standalone: true,
  templateUrl: './order-status-timeline.component.html',
  styleUrl: './order-status-timeline.component.scss',
})
export class OrderStatusTimelineComponent {
  readonly status = input.required<OrderStatus>();

  readonly isCancelled = computed(() => this.status() === 'cancelado');

  readonly cancelledLabel = computed(() => describeOrderStatus('cancelado').label);

  readonly steps = computed<readonly OrderStatusStepViewModel[]>(() => {
    const cancelled = this.isCancelled();
    const currentIndex = HAPPY_PATH_STEPS.indexOf(this.status());
    return HAPPY_PATH_STEPS.map((step) => {
      const index = HAPPY_PATH_STEPS.indexOf(step);
      let state: OrderStatusStepState = 'upcoming';
      if (!cancelled && currentIndex >= 0) {
        if (index < currentIndex) state = 'done';
        else if (index === currentIndex) state = 'current';
      }
      return { status: step, label: describeOrderStatus(step).label, state };
    });
  });
}
