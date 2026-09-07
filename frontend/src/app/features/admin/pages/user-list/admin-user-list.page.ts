import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import {
  ADMIN_USER_ROLES,
  AdminUserRole,
  AdminUserViewModel,
  describeAdminUserRole,
} from '../../models/admin-user.model';
import { AdminUsersMockService, AdminUsersMockState } from '../../services/admin-users-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'error';
type RoleFilter = AdminUserRole | 'todos';

const ROLE_FILTER_OPTIONS: readonly RoleFilter[] = ['todos', ...ADMIN_USER_ROLES];

/**
 * Staff user list (`/admin/users`) — RF-03 ("Autorización por rol / gestión de roles y
 * permisos"), actor Administrador (`docs/discovery/06-system-definition.md` line 52). Figma has
 * ZERO relevant frames (grepped for "usuario"/"rol"/"permiso"/"role", only two prose false
 * positives — line 264 independently confirms: "Gestión de roles (RF-03) | — | No existe
 * pantalla"), so this screen reuses the existing admin design system (`AdminDataTableComponent`,
 * `AdminPageHeaderComponent`) per Constitution Principle XV, exactly like every other admin list.
 *
 * The route is already Administrador-only end to end (the `/admin/users` child guard in
 * `app.routes.ts`) — no additional component-level role check is added here (unlike
 * `AdminIncidentDetailPage`'s `canManage`, which exists specifically because that domain's actor
 * set is broader than just Administrador).
 *
 * No REST contract exists yet — `AdminUsersMockService` is an isolated, frontend-only preview.
 * `?mockState=empty`/`?mockState=error` preview those states, same convention as every other
 * admin list. Search (by email, case-insensitive substring) and role filtering are pure local
 * narrowing of the already-fetched list, same "search signal + filter signal + computed filtered
 * list" approach as `AdminProductListPage`/`AdminIncidentListPage` — no Figma reference dictates
 * these filter dimensions, this is a reasonable design consistent with every other admin list.
 */
@Component({
  selector: 'app-admin-user-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AdminPageHeaderComponent,
    AdminDataTableComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-user-list.page.html',
  styleUrl: './admin-user-list.page.scss',
})
export class AdminUserListPage {
  private readonly usersService = inject(AdminUsersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly users = signal<AdminUserViewModel[]>([]);

  readonly search = signal('');
  readonly roleFilter = signal<RoleFilter>('todos');

  readonly roleFilterOptions = ROLE_FILTER_OPTIONS;

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  private currentMockState: AdminUsersMockState = 'populated';

  readonly filteredUsers = computed(() => {
    const query = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    return this.users().filter((user) => {
      if (role !== 'todos' && user.role !== role) {
        return false;
      }
      if (query && !user.email.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const value = params.get('mockState');
      this.currentMockState = value === 'empty' || value === 'error' ? value : 'populated';
      this.load(this.currentMockState);
    });
  }

  retry(): void {
    this.load(this.currentMockState);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateRoleFilter(value: string): void {
    this.roleFilter.set(value as RoleFilter);
  }

  roleLabel(role: AdminUserRole): string {
    return describeAdminUserRole(role).label;
  }

  roleTone(role: AdminUserRole): 'neutral' | 'info' | 'success' | 'danger' {
    return describeAdminUserRole(role).tone;
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  private load(mockState: AdminUsersMockState): void {
    this.status.set('loading');
    this.usersService
      .getUsers(mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
