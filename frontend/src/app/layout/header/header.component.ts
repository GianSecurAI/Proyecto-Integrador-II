import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';
import { CartStateService } from '../../features/cart/services/cart-state.service';

/**
 * Global navigation chrome, present on every route. Visual language adapted from the Header
 * pattern repeated across all 11 Figma screens (docs/discovery/05-figma-analysis.md §2/§9:
 * black surface, hard shadow, uppercase bold). Figma's header also has a product-search bar,
 * which stays catalog-page-scoped (see `features/catalog/components/catalog-toolbar/`) rather
 * than living here — no feature is implemented ahead of a confirmed requirement (Constitution
 * Principle I, Prohibited Practice #7). The "Catálogo" link below is real now that `/catalog`
 * exists (RF-07/RF-08, docs/discovery/05-figma-analysis.md §1).
 *
 * The cart link (with its live item-count badge, driven by `CartStateService`) was added once
 * the standard-catalog self-service cart was built (`features/cart/`, CLAUDE.md's "Business
 * clarification: purchasing flows") — reusing the same `ui-btn` visual convention as every other
 * header action rather than inventing a new button style. It is NOT the same thing the earlier
 * version of this comment excluded: this is the standard-catalog cart only, never a checkout for
 * the advisor-mediated WhatsApp custom-order flow.
 *
 * The auth entry point reflects `SessionStateService` (already used by the OTP feature) rather
 * than a hardcoded "Acceder" label, so this is real client state, not mock content.
 *
 * `logout()` (staff-auth widening task) clears the local session flag and returns the visitor to
 * the public home page — a reasonable, non-surprising public destination for every role
 * (Cliente/Asesor/Administrador alike). This is client-side UX only: it merely stops the frontend
 * from *believing* it is signed in (Constitution Principle III — the frontend is never
 * authoritative). A real backend session (the httpOnly cookie `SessionStateService`'s own doc
 * comment describes) would need its own real logout endpoint to actually invalidate server-side;
 * no such endpoint exists yet, consistent with this whole feature staying mock/preview-only.
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
  private readonly router = inject(Router);
  private readonly cart = inject(CartStateService);

  readonly isAuthenticated = this.session.isAuthenticated;
  /** Live cart item count driving the header badge — reads directly from `CartStateService`
   * (the single source of truth for cart state), never a locally-held copy. */
  readonly cartItemCount = this.cart.itemCount;
  /** Drives which authenticated link the header shows (see header.component.html): a Cliente
   * gets "Mi cuenta" (`/account`), staff (Administrador/Asesor) gets "Panel de administración"
   * (`/admin`) instead — showing "Mi cuenta" to a staff session would be a dead-end link, since
   * `/account` is guarded to `CLIENTE` alone (`app.routes.ts`). UX convenience only, same
   * disclaimer as `features/admin/layout/admin-sidebar/`: the route guard is what actually
   * enforces access either way. */
  readonly isStaff = computed(() => {
    const role = this.session.currentRole();
    return role === 'ADMINISTRADOR' || role === 'ASESOR';
  });

  logout(): void {
    this.session.clear();
    void this.router.navigateByUrl('/');
  }
}
