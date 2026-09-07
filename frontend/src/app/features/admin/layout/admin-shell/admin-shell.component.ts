import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';
import { AdminTopbarComponent } from '../admin-topbar/admin-topbar.component';

/**
 * Parent shell for the whole `/admin` route tree (composed the same way
 * `layout/shell/shell.component.ts` composes the public shell: dedicated chrome + a routed
 * content region), but intentionally self-contained rather than a variant of the public shell —
 * the admin area has a completely different nav model (role-gated sidebar of six domains, no
 * marketing footer) and reusing `ShellComponent` for it would force one component to understand
 * two unrelated chrome systems. `layout/shell/shell.component.ts` hides the public
 * header/footer under `/admin/**` precisely so this component can supply its own instead.
 *
 * Owns the single `sidebarOpen` signal that both `AdminTopbarComponent` (the toggle button) and
 * `AdminSidebarComponent` (the off-canvas panel that reads it) need — kept here rather than in
 * either child so the two stay simple, presentational components with no shared mutable state of
 * their own.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, AdminTopbarComponent, AdminSidebarComponent],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly _sidebarOpen = signal(false);
  readonly sidebarOpen = this._sidebarOpen.asReadonly();

  toggleSidebar(): void {
    this._sidebarOpen.update((open) => !open);
  }
}
