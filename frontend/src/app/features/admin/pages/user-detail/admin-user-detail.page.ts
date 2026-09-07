import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminConfirmDialogComponent } from '../../components/admin-confirm-dialog/admin-confirm-dialog.component';
import {
  ADMIN_USER_ROLES,
  AdminUserRole,
  AdminUserViewModel,
  describeAdminUserRole,
} from '../../models/admin-user.model';
import { AdminUsersMockService, AdminUsersMockState } from '../../services/admin-users-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * A single pending confirm-dialog trigger — at most one of the two gated actions on this page
 * (role change, deactivation) can be awaiting confirmation at a time, so ONE
 * `AdminConfirmDialogComponent` instance is reused for both (never a second dialog component),
 * with its title/description/confirm handler switched on `.type`. Mirrors
 * `AdminProductListPage.pendingDeactivation`'s single-pending-action-signal pattern, generalized
 * to two distinct action shapes instead of one.
 */
type PendingAction = { readonly type: 'role-change'; readonly newRole: AdminUserRole } | { readonly type: 'deactivate' };

/**
 * Staff user-detail screen (`/admin/users/:id`) — RF-03 ("Autorización por rol / gestión de
 * roles y permisos"), actor Administrador. Reached from `AdminUserListPage`. Same "no Figma
 * frame exists, reuse the admin design system" basis as every other admin detail page's doc
 * comment (see `AdminProductDetailPage`).
 *
 * The route is already Administrador-only end to end (the `/admin/users/:id` child guard in
 * `app.routes.ts`) — no additional component-level role check is added here, same reasoning as
 * `AdminUserListPage`'s doc comment.
 *
 * ROLE CHANGE: a `<select>` of the three `AdminUserRole` values, defaulting to the user's current
 * role. Submitting when the selection differs from the current role opens
 * `AdminConfirmDialogComponent` (REUSED, not a new dialog) showing "from X to Y" before calling
 * `AdminUsersMockService.changeRole`. Submitting with the already-current role selected is a
 * deliberate no-op — no dialog, no service call — since there is nothing to confirm.
 *
 * ACCOUNT STATUS: follows the exact asymmetric pattern already established for product
 * availability (`AdminProductListPage.requestDeactivate`/`activate`) — deactivating
 * (`active: true -> false`) is gated by the same confirm dialog (a second, distinct trigger
 * reusing the one dialog component); reactivating (`false -> true`) is immediate/non-destructive,
 * no dialog.
 *
 * Loading/error/not-found states mirror `AdminProductDetailPage`'s conventions exactly.
 */
@Component({
  selector: 'app-admin-user-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    AdminConfirmDialogComponent,
  ],
  templateUrl: './admin-user-detail.page.html',
  styleUrl: './admin-user-detail.page.scss',
})
export class AdminUserDetailPage {
  private readonly usersService = inject(AdminUsersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly user = signal<AdminUserViewModel | null>(null);

  readonly allRoles = ADMIN_USER_ROLES;
  readonly selectedRole = signal<AdminUserRole | null>(null);

  readonly pendingAction = signal<PendingAction | null>(null);

  readonly roleChanging = signal(false);
  readonly roleError = signal<string | null>(null);
  readonly roleSuccess = signal<string | null>(null);

  readonly activeChanging = signal(false);
  readonly activeError = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  private currentId = '';

  readonly dialogTitle = computed(() => {
    const action = this.pendingAction();
    if (!action) return '';
    return action.type === 'role-change' ? '¿Cambiar el rol de este usuario?' : '¿Desactivar esta cuenta?';
  });

  readonly dialogDescription = computed(() => {
    const action = this.pendingAction();
    const current = this.user();
    if (!action || !current) return null;
    if (action.type === 'role-change') {
      return (
        `El usuario «${current.email}» pasará de ${this.roleLabel(current.role)} a ` +
        `${this.roleLabel(action.newRole)}.`
      );
    }
    return `La cuenta «${current.email}» quedará bloqueada y no podrá acceder al sistema hasta que se reactive.`;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(params.get('id') ?? '');
    });
  }

  retry(): void {
    this.load(this.currentId);
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

  updateSelectedRole(value: string): void {
    this.selectedRole.set(value as AdminUserRole);
  }

  /** Submitting the role-change control. A no-op (no dialog, no service call) when the selected
   * role is already the user's current role — see this class's doc comment. */
  requestRoleChange(): void {
    const current = this.user();
    const next = this.selectedRole();
    if (!current || !next || next === current.role) return;
    this.roleError.set(null);
    this.roleSuccess.set(null);
    this.pendingAction.set({ type: 'role-change', newRole: next });
  }

  /** Deactivation (`true -> false`) is account-access-affecting — gated behind the confirm
   * dialog. */
  requestDeactivate(): void {
    this.activeError.set(null);
    this.pendingAction.set({ type: 'deactivate' });
  }

  /** Reactivation (`false -> true`) is non-destructive — applied immediately, no confirmation. */
  activate(): void {
    const current = this.user();
    if (!current || this.activeChanging()) return;
    this.applyActive(current.id, true);
  }

  cancelPendingAction(): void {
    this.pendingAction.set(null);
  }

  confirmPendingAction(): void {
    const action = this.pendingAction();
    const current = this.user();
    this.pendingAction.set(null);
    if (!action || !current) return;
    if (action.type === 'role-change') {
      this.applyRoleChange(current.id, action.newRole);
    } else {
      this.applyActive(current.id, false);
    }
  }

  private applyRoleChange(id: string, newRole: AdminUserRole): void {
    this.roleChanging.set(true);
    this.roleError.set(null);
    this.usersService
      .changeRole(id, newRole)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.roleChanging.set(false);
          this.user.set(updated);
          this.selectedRole.set(updated.role);
          this.roleSuccess.set('El rol del usuario se actualizó correctamente.');
        },
        error: () => {
          this.roleChanging.set(false);
          this.roleError.set('No pudimos actualizar el rol. Inténtalo de nuevo más tarde.');
        },
      });
  }

  private applyActive(id: string, active: boolean): void {
    this.activeChanging.set(true);
    this.activeError.set(null);
    this.usersService
      .setActive(id, active)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.activeChanging.set(false);
          this.user.set(updated);
        },
        error: () => {
          this.activeChanging.set(false);
          this.activeError.set('No pudimos actualizar el estado de la cuenta. Inténtalo de nuevo más tarde.');
        },
      });
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    const mockState: AdminUsersMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.pendingAction.set(null);
    this.roleError.set(null);
    this.roleSuccess.set(null);
    this.activeError.set(null);
    this.usersService
      .getUserById(id, mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.selectedRole.set(user.role);
          this.status.set('loaded');
        },
        error: () => {
          this.user.set(null);
          this.status.set(mockState === 'error' ? 'error' : 'not-found');
        },
      });
  }
}
