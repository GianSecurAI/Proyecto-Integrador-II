import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { apiErrorCode, httpStatus } from '../../../../core/models/api-error.model';
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
  STAFF_PROVISION_ROLES,
  describeAdminUserRole,
} from '../../models/admin-user.model';
import { AdminUsersService } from '../../services/admin-users.service';

type LoadStatus = 'loading' | 'loaded' | 'error';
type RoleFilter = AdminUserRole | 'todos';
type ActiveFilter = 'todos' | 'activos' | 'inactivos';

/** Delay before a typed search is sent to the server. */
export const USER_SEARCH_DEBOUNCE_MS = 300;

/**
 * RF-03 admin user list (ADMINISTRADOR only; the backend answers 403 to anyone else), backed by
 * `GET /api/admin/users`: search (`q`, email), role and active filters and paging are SERVER-side.
 * It also hosts the staff-provisioning form (`POST /api/admin/users`): an administrator provisions
 * an ASESOR/ADMINISTRADOR account by email and that person then signs in with the email OTP.
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
  private readonly usersService = inject(AdminUsersService);

  readonly status = signal<LoadStatus>('loading');
  readonly users = signal<AdminUserViewModel[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly search = signal('');
  readonly roleFilter = signal<RoleFilter>('todos');
  readonly activeFilter = signal<ActiveFilter>('todos');

  readonly roleFilterOptions: readonly RoleFilter[] = ['todos', ...ADMIN_USER_ROLES];
  readonly provisionRoles = STAFF_PROVISION_ROLES;

  // Staff provisioning form (UX-only validation; the server re-validates and may answer 409).
  readonly newStaffEmail = signal('');
  readonly newStaffRole = signal<AdminUserRole>('ASESOR');
  readonly provisioning = signal(false);
  readonly provisionError = signal<string | null>(null);
  readonly provisionSuccess = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  private request: Subscription | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  retry(): void {
    this.load();
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), USER_SEARCH_DEBOUNCE_MS);
  }

  updateRoleFilter(value: string): void {
    this.roleFilter.set(value as RoleFilter);
    this.page.set(0);
    this.load();
  }

  updateActiveFilter(value: string): void {
    this.activeFilter.set(value as ActiveFilter);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  hasActiveFilters(): boolean {
    return (
      this.search().trim() !== '' || this.roleFilter() !== 'todos' || this.activeFilter() !== 'todos'
    );
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

  updateNewStaffEmail(value: string): void {
    this.newStaffEmail.set(value);
  }

  updateNewStaffRole(value: string): void {
    this.newStaffRole.set(value as AdminUserRole);
  }

  /** Light UX check only (the server validates the address). */
  get newStaffEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newStaffEmail().trim());
  }

  provisionStaff(): void {
    if (this.provisioning() || !this.newStaffEmailValid) return;
    this.provisioning.set(true);
    this.provisionError.set(null);
    this.provisionSuccess.set(null);
    this.usersService.createStaff(this.newStaffEmail(), this.newStaffRole()).subscribe({
      next: (created) => {
        this.provisioning.set(false);
        this.newStaffEmail.set('');
        this.provisionSuccess.set(
          `Cuenta creada para ${created.email}. Ingresará con un código enviado a su correo.`,
        );
        this.load();
      },
      error: (err: unknown) => {
        this.provisioning.set(false);
        if (httpStatus(err) === 409) {
          this.provisionError.set('Ya existe una cuenta con ese correo.');
        } else if (apiErrorCode(err) === 'VALIDATION_FAILED') {
          this.provisionError.set('El servidor rechazó el correo o el rol. Revísalos e inténtalo de nuevo.');
        } else {
          this.provisionError.set('No pudimos crear la cuenta. Inténtalo de nuevo más tarde.');
        }
      },
    });
  }

  private load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    const role = this.roleFilter();
    const active = this.activeFilter();
    this.request = this.usersService
      .list({
        q: this.search(),
        role: role === 'todos' ? null : role,
        active: active === 'todos' ? null : active === 'activos',
        page: this.page(),
      })
      .subscribe({
        next: (result) => {
          this.users.set(result.content);
          this.totalPages.set(result.totalPages);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
