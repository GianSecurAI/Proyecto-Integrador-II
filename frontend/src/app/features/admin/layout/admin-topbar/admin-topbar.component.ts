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
 * User-menu/logout (staff-auth widening task): the `/admin` shell is now genuinely reachable via
 * the same OTP flow customers use (`features/auth/pages/verify-code/verify-code.page.ts` resolves
 * an ADMINISTRADOR/ASESOR role for known staff emails), so a static "Administrador" label would
 * misrepresent whoever is actually signed in — this now reads `SessionStateService.currentRole`/
 * `currentEmail` instead. `logout()` only clears the local, non-authoritative session flag
 * (Constitution Principle III — the frontend is never the source of truth); there is no real
 * backend session/logout endpoint yet, consistent with the rest of this preview build.
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
    this.session.clear();
    void this.router.navigateByUrl('/');
  }
}
