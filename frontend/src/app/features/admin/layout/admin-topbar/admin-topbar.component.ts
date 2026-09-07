import { Component, input, output } from '@angular/core';

/**
 * Admin area topbar: the sidebar-toggle control (for the narrow-viewport off-canvas nav — see
 * `admin-sidebar.component.scss` for the collapse breakpoint) plus a fixed "we are in the admin
 * panel" page context. No user-menu/logout is rendered — no admin authentication flow exists yet
 * (`app.routes.ts`'s `/admin` guard is deliberately unreachable in the running preview until one
 * is built), so "Administrador" is a static label, not real session data (would otherwise
 * misrepresent an unauthenticated preview as a signed-in admin session).
 *
 * The specific per-screen title (e.g. "Productos") is rendered by `AdminPageHeaderComponent`
 * inside each page's own content, not duplicated here — this topbar's "page context" is scoped
 * to identifying the admin *section* as a whole (distinguishing it from the public storefront
 * chrome it replaces), which is the "at minimum" bar this component needs to clear.
 */
@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  templateUrl: './admin-topbar.component.html',
  styleUrl: './admin-topbar.component.scss',
})
export class AdminTopbarComponent {
  readonly sidebarOpen = input(false);
  readonly toggleSidebar = output<void>();
}
