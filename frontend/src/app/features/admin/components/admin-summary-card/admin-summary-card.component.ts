import { Component, computed, input } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { StatusBadgeTone } from '../../../../shared/ui/status-badge/status-badge.component';

/**
 * Small, reusable "label + big number + optional caption" presentational primitive — the
 * "summary card" building block RF-19's report screens need
 * (`docs/discovery/06-system-definition.md` line 330: "Reportes básicos de pedidos/cotizaciones/
 * incidencias con al menos un filtro de rango de fechas"). Nothing here existed yet in this
 * codebase (unlike tables/badges/dialogs, already built by prior admin tasks) — introduced for
 * `pages/reports/admin-reports.page.ts`, the sole consumer so far.
 *
 * Purely presentational: renders whatever `label`/`value`/`caption`/`tone` the caller supplies and
 * makes no decision of its own about what those values mean (Constitution Prohibited Practice #5)
 * — every count/aggregation is computed by the page, never here.
 *
 * Reuses `shared/ui/status-badge`'s `StatusBadgeTone` vocabulary (neutral/info/success/danger) for
 * the optional accent stripe, rather than inventing a parallel color vocabulary, and
 * `shared/ui/card` for the visual shell (border + hard shadow), consistent with the rest of the
 * admin design system (Constitution Principle XV). The accent is rendered as a left border stripe
 * on the card, never as colored TEXT — `--ar-color-accent-info` in particular does not meet WCAG
 * AA contrast as text on a white surface (see `_tokens.scss`'s own contrast note), so the number
 * itself always stays the default high-contrast text color and only the stripe carries the tone.
 */
@Component({
  selector: 'app-admin-summary-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './admin-summary-card.component.html',
  styleUrl: './admin-summary-card.component.scss',
})
export class AdminSummaryCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly caption = input<string | null>(null);
  readonly tone = input<StatusBadgeTone>('neutral');

  readonly hostClasses = computed(
    () => `admin-summary-card admin-summary-card--${this.tone()}`,
  );
}
