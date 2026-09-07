import { Component, computed, input } from '@angular/core';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'danger';

/**
 * Generic, business-agnostic "label + semantic color" pill, extracted so any feature with its
 * own status vocabulary (orders today — `features/account/components/order-status-badge/`;
 * incidents/quotations later, both of which also carry an `estado` field per
 * docs/discovery/06-system-definition.md lines 143-144) can render a consistent visual treatment
 * without this component knowing anything about that vocabulary itself. It never maps a status
 * *value* to a label/tone on its own — that mapping is each feature's own concern (Constitution
 * Prohibited Practice #5: this component makes no business decision, purely presentation).
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusBadgeTone>('neutral');

  readonly classes = computed(() => `ui-status-badge ui-status-badge--${this.tone()}`);
}
