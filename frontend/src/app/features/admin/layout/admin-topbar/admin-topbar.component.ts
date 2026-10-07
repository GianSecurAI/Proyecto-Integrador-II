import { AuthService } from '../../../auth/services/auth.service';
import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';

/**
 * Admin area topbar: the sidebar-toggle control (for the narrow-viewport off-canvas nav — see
 * `admin-sidebar.component.scss` for the collapse breakpoint), a fixed "we are in the admin
 * panel" page context, and the signed-in staff member's own identity plus a working logout
 * control.
 *
 * The specific per-screen title (e.g. "Productos") is rendered by `AdminPageHeaderComponent`
 * inside each page's own content, not duplicated here — this topbar's "page context" is scoped
 * to identifying the admin *section* as a whole (distinguishing it from the public storefront
 * chrome it replaces), which is the "at minimum" bar this component needs to clear.
 *
 * The `/admin` shell is reached through the same email-OTP flow customers use; the server
 * reports the role, and this topbar shows `SessionStateService.currentRole`/`currentEmail`.
 * `logout()` calls `POST /api/auth/logout` (idempotent) and clears the local session mirror either
 * way (Constitution Principle III — the frontend is never the source of truth).
 */
@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  templateUrl: './admin-topbar.component.html',
  styleUrl: './admin-topbar.component.scss',
})
export class AdminTopbarComponent {
  private readonly session = inject(SessionStateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly sidebarOpen = input(false);
  readonly toggleSidebar = output<void>();

  readonly currentEmail = this.session.currentEmail;
  /** Human-readable role label. Falls back to "Administración" in the (in-practice unreachable,
   * since the parent route already guards to `STAFF_ROLES`) case where role is somehow unknown —
   * never silently claims a specific role that was not actually confirmed. */
  readonly roleLabel = computed(() => {
    const role = this.session.currentRole();
    if (role === 'ADMINISTRADOR') return 'Administrador';
    if (role === 'ASESOR') return 'Asesor';
    return 'Administración';
  });

  logout(): void {
    // Revokes the server-side session (POST /api/auth/logout) and clears local state either way.
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}
