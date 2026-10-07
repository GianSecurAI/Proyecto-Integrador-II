import { Component, computed, input } from '@angular/core';
import { OrderStatus, describeOrderStatus } from '../../models/wire-enums';

export type OrderStatusStepState = 'done' | 'current' | 'upcoming';

export interface OrderStatusStepViewModel {
  readonly status: OrderStatus;
  readonly label: string;
  readonly state: OrderStatusStepState;
}

/** Happy-path step order. `cancelado` is intentionally excluded — it is a terminal, off-path
 * state handled separately (see `isCancelled`), not a further step along this sequence. */
const HAPPY_PATH_STEPS: readonly OrderStatus[] = [
  'CONFIRMADO',
  'EN_PRODUCCION',
  'ENVIADO',
  'ENTREGADO',
];

/**
 * Shared, order-domain visual status timeline: an ordered step list (Confirmado →
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

  readonly isCancelled = computed(() => this.status() === 'CANCELADO');

  readonly cancelledLabel = computed(() => describeOrderStatus('CANCELADO').label);

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
