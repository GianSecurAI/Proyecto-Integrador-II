import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface AdminNavItem {
  readonly label: string;
  readonly path: string;
}

/**
 * The six approved admin domains, each tracing to a "Confirmado" requirement in
 * `docs/discovery/06-system-definition.md`:
 * - Productos     -> RF-07 (lines 197-201: alta/edición/activación de productos)
 * - Pedidos       -> RF-13 (gestión de estados del pedido)
 * - Cotizaciones  -> RF-10 (registro y gestión de cotización por Asesor/Administrador)
 * - Incidencias   -> RF-16/17/18 (gestión de estado, prioridad, resolución)
 * - Reportes      -> RF-19 (reportes de pedidos/cotizaciones/incidencias, exclusivo Administrador)
 * - Usuarios y roles -> RF-03 (autorización por rol / gestión de roles y permisos)
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
  { label: 'Productos', path: '/admin/products' },
  { label: 'Pedidos', path: '/admin/orders' },
  { label: 'Cotizaciones', path: '/admin/quotations' },
  { label: 'Incidencias', path: '/admin/incidents' },
  { label: 'Reportes', path: '/admin/reports' },
  { label: 'Usuarios y roles', path: '/admin/users' },
];

/**
 * Admin navigation. Active-link styling follows the exact same convention already used by
 * `features/account/components/account-nav/` (`routerLinkActive` toggling a modifier class) —
 * this adds `aria-current="page"` on top of that same mechanism (via the `routerLinkActive`
 * directive's exported `isActive`) for a non-visual, screen-reader-facing current-route
 * indicator, per Constitution Principle XVI, rather than inventing a different active-link
 * pattern from the rest of the app.
 */
@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  /** Controls the off-canvas open/closed state on narrow viewports (ignored above the
   * collapse breakpoint, where the sidebar is always visible — see the component's stylesheet). */
  readonly open = input(false);

  readonly navItems = ADMIN_NAV_ITEMS;
}
