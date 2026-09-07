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
import { AdminOrderSummaryViewModel } from '../../models/admin-order.model';
import { AdminOrdersMockService, AdminOrdersMockState } from '../../services/admin-orders-mock.service';
import { OrderKind, OrderStatus, describeOrderStatus } from '../../../account/models/order.model';

type LoadStatus = 'loading' | 'loaded' | 'error';
type KindFilter = OrderKind | 'todos';
type StatusFilter = OrderStatus | 'todos';

const STATUS_FILTER_OPTIONS: readonly StatusFilter[] = [
  'todos',
  'pendiente',
  'confirmado',
  'en_produccion',
  'enviado',
  'entregado',
  'cancelado',
];

const KIND_FILTER_LABELS: Record<KindFilter, string> = {
  todos: 'Todos',
  estandar: 'Estándar',
  personalizado: 'Personalizado',
};

/**
 * Staff order list (`/admin/orders`) — RF-13 ("Gestión de los estados del pedido", actor
 * Administrador/Asesor) and the entry point to RF-11's registration flow via the page-header
 * action. Figma has ZERO relevant frames (grepped for "gestionar pedido"/"registrar pedido"/
 * "asesor"/"advisor", zero matches — `docs/discovery/06-system-definition.md` line 257
 * independently confirms RF-10 has "No existe pantalla"), so this screen reuses the existing
 * admin design system (`AdminDataTableComponent`, `AdminPageHeaderComponent`) per Constitution
 * Principle XV, exactly like `AdminProductListPage`.
 *
 * No REST contract exists yet — `AdminOrdersMockService` is an isolated, frontend-only preview,
 * seeded with orders across MULTIPLE customers (distinct from `CustomerOrdersMockService`).
 * `?mockState=empty`/`?mockState=error` preview those states, same convention as every other
 * admin list.
 *
 * Filtering (by order id, customer email, status, kind) is pure local narrowing of the
 * already-fetched list — the exact "search signal + filter signal(s) + computed filtered list"
 * approach `AdminProductListPage` already established, just with one more filter dimension.
 */
@Component({
  selector: 'app-admin-order-list-page',
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
  templateUrl: './admin-order-list.page.html',
  styleUrl: './admin-order-list.page.scss',
})
export class AdminOrderListPage {
  private readonly ordersService = inject(AdminOrdersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly orders = signal<AdminOrderSummaryViewModel[]>([]);

  /** Matches against both the order id and the customer email — a single search box covers both
   * dimensions named in the brief ("by order id, by customer email"), avoiding two near-identical
   * text inputs for what a staff user experiences as one "find this order" action. */
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly kindFilter = signal<KindFilter>('todos');

  readonly statusFilterOptions = STATUS_FILTER_OPTIONS;
  readonly kindFilterLabels = KIND_FILTER_LABELS;

  private currentMockState: AdminOrdersMockState = 'populated';

  readonly filteredOrders = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const kind = this.kindFilter();
    return this.orders().filter((order) => {
      if (status !== 'todos' && order.status !== status) {
        return false;
      }
      if (kind !== 'todos' && order.kind !== kind) {
        return false;
      }
      if (
        query &&
        !order.id.toLowerCase().includes(query) &&
        !order.customerEmail.toLowerCase().includes(query)
      ) {
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

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  updateKindFilter(value: string): void {
    this.kindFilter.set(value as KindFilter);
  }

  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  statusTone(status: OrderStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeOrderStatus(status).tone;
  }

  private load(mockState: AdminOrdersMockState): void {
    this.status.set('loading');
    this.ordersService
      .getOrders(mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
