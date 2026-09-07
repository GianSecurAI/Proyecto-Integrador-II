import { Component, input } from '@angular/core';
import { PolicySection } from '../../models/policy-section.model';

/**
 * Shared presentational renderer for the "heading + numbered card list" pattern repeated across
 * all four static policy pages (privacy, refund, terms of service, shipping) — see
 * `models/policy-section.model.ts` for the structural rationale and Figma provenance. Purely
 * presentational: it owns no content of its own and makes no business decisions, only rendering
 * whatever `sections` its caller supplies.
 *
 * Each section renders as one bordered, numbered card with an `<h2>` heading (never skipping to
 * `<h3>`) so every consuming page keeps a single accessible heading hierarchy: page `<h1>` →
 * section `<h2>` (Constitution Principle XVI).
 */
@Component({
  selector: 'app-policy-section-list',
  standalone: true,
  templateUrl: './policy-section-list.component.html',
  styleUrl: './policy-section-list.component.scss',
})
export class PolicySectionListComponent {
  readonly sections = input.required<readonly PolicySection[]>();
}
