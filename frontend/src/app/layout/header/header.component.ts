import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';

/**
 * Global navigation chrome, present on every route. Visual language adapted from the Header
 * pattern repeated across all 11 Figma screens (docs/discovery/05-figma-analysis.md §2/§9:
 * black surface, hard shadow, uppercase bold). Content is intentionally minimal: Figma's
 * header also has a product-search bar and a cart icon, both of which assume a self-service
 * cart that is not built (an explicit `CONFLICT`/exclusion per project requirements) — no feature is
 * implemented ahead of a confirmed requirement (Constitution Principle I, Prohibited Practice
 * #7), so search stays catalog-page-scoped (see `features/catalog/components/catalog-toolbar/`)
 * rather than living here. The "Catálogo" link below is real now that `/catalog` exists
 * (RF-07/RF-08, docs/discovery/05-figma-analysis.md §1).
 *
 * The auth entry point reflects `SessionStateService` (already used by the OTP feature) rather
 * than a hardcoded "Acceder" label, so this is real client state, not mock content.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private readonly session = inject(SessionStateService);

  readonly isAuthenticated = this.session.isAuthenticated;
}
