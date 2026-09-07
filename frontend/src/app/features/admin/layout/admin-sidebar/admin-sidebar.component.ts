import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ADMIN_ONLY_ROLES, AppRole } from '../../../../core/auth/roles';
import { SessionStateService } from '../../../../core/services/session-state.service';

interface AdminNavItem {
  readonly label: string;
  readonly path: string;
  /** Roles that can actually reach this item's route — mirrors the per-child `role:` guard each
   * corresponding route carries in `app.routes.ts` (`ADMIN_ONLY_ROLES` there). `undefined` means
   * every role allowed into the `/admin` shell at all (i.e. both staff roles) can reach it. Kept
   * here ONLY to decide what to render — see this class's doc comment for why that is explicitly
   * NOT the security boundary. */
  readonly roles?: readonly AppRole[];
}

/**
 * The six approved admin domains, each tracing to a "Confirmado" requirement in
 * `docs/discovery/06-system-definition.md`:
 * - Productos     -> RF-07 (lines 197-201: alta/edición/activación de productos) — Administrador-only.
 * - Pedidos       -> RF-13 (gestión de estados del pedido) — Administrador/Asesor.
 * - Cotizaciones  -> RF-10 (registro y gestión de cotización por Asesor/Administrador).
 * - Incidencias   -> RF-16/17/18 (gestión de estado, prioridad, resolución) — Administrador/Asesor.
 * - Reportes      -> RF-19 (reportes de pedidos/cotizaciones/incidencias, exclusivo Administrador).
 * - Usuarios y roles -> RF-03 (autorización por rol / gestión de roles y permisos) — Administrador-only.
 *
 * No other domain is listed here on purpose — Figma has zero admin frames
 * (docs/discovery/05-figma-analysis.md, 06-system-definition.md lines 260-264 confirm a total
 * absence, not a partial gap) and PrintCrate's admin surface is Django's generic scaffolding,
 * already classified REJECT for RBAC (docs/discovery/03-printcrate-analysis.md line ~285) — so
 * nothing here is copied from either source. Adding a "dashboard/analytics" landing item or a
 * "settings" item would be inventing a screen with no requirement ID (Constitution Principle I),
 * so neither exists.
 */
const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: 'Productos', path: '/admin/products', roles: ADMIN_ONLY_ROLES },
  { label: 'Pedidos', path: '/admin/orders' },
  { label: 'Cotizaciones', path: '/admin/quotations' },
  { label: 'Incidencias', path: '/admin/incidents' },
  { label: 'Reportes', path: '/admin/reports', roles: ADMIN_ONLY_ROLES },
  { label: 'Usuarios y roles', path: '/admin/users', roles: ADMIN_ONLY_ROLES },
];

/**
 * Admin navigation. Active-link styling follows the exact same convention already used by
 * `features/account/components/account-nav/` (`routerLinkActive` toggling a modifier class) —
 * this adds `aria-current="page"` on top of that same mechanism (via the `routerLinkActive`
 * directive's exported `isActive`) for a non-visual, screen-reader-facing current-route
 * indicator, per Constitution Principle XVI, rather than inventing a different active-link
 * pattern from the rest of the app.
 *
 * ROLE-AWARE FILTERING, NOT A SECURITY BOUNDARY (staff-auth widening task — read this before
 * touching `navItems`): every visitor of this sidebar is already one of `STAFF_ROLES` (the parent
 * `/admin` route guards to that — `app.routes.ts`), but Asesor is further guarded away from
 * Productos/Reportes/Usuarios by each of those routes' own stricter child-level guard
 * (`ADMIN_ONLY_ROLES`). Showing an Asesor a link that just bounces them to `/forbidden` on click
 * is a bad, avoidable UX — so `navItems` filters those three items out for a non-Administrador
 * session. This is a LEGITIMATE but NON-AUTHORITATIVE UX improvement, exactly as Constitution
 * Principle III requires ("the frontend is never the source of truth" for permissions) and
 * exactly the same reasoning `admin-incident-detail.page.ts`'s `canManage` check already
 * documents: hiding a button/nav item must NEVER be relied on as the only protection for
 * anything — the real enforcement is, and remains, `core/guards/auth.guard.ts` re-checking the
 * destination route independently of whether a link to it was ever shown.
 */
@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  private readonly session = inject(SessionStateService);

  /** Controls the off-canvas open/closed state on narrow viewports (ignored above the
   * collapse breakpoint, where the sidebar is always visible — see the component's stylesheet). */
  readonly open = input(false);

  readonly navItems = computed(() => {
    const role = this.session.currentRole();
    return ADMIN_NAV_ITEMS.filter(
      (item) => !item.roles || (role !== null && item.roles.includes(role)),
    );
  });
}
