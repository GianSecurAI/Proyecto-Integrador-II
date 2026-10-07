import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ORDER_KINDS,
  ORDER_STATUSES,
  OrderKind,
  OrderStatus,
  describeOrderStatus,
  orderKindLabel,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminOrderSummaryViewModel } from '../../models/admin-order.model';
import { AdminOrdersService } from '../../services/admin-orders.service';

type LoadStatus = 'loading' | 'loaded' | 'error';
type KindFilter = OrderKind | 'todos';
type StatusFilter = OrderStatus | 'todos';

/** Delay before a typed search is sent to the server. */
export const ORDER_SEARCH_DEBOUNCE_MS = 300;

/**
 * RF-13 staff order list (ASESOR and ADMINISTRADOR), backed by `GET /api/admin/orders`. Search
 * (`q`: order id or customer email), status, kind and the optional `from`/`to` date range
 * (YYYY-MM-DD, inclusive) are applied SERVER-side and the result is paged by the server; this page
 * only turns filter state into query parameters and renders the returned page.
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
  private readonly ordersService = inject(AdminOrdersService);

  readonly status = signal<LoadStatus>('loading');
  readonly orders = signal<AdminOrderSummaryViewModel[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly kindFilter = signal<KindFilter>('todos');
  readonly fromDate = signal('');
  readonly toDate = signal('');

  readonly statusFilterOptions: readonly StatusFilter[] = ['todos', ...ORDER_STATUSES];
  readonly kindOptions: readonly OrderKind[] = ORDER_KINDS;

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
    this.timer = setTimeout(() => this.load(), ORDER_SEARCH_DEBOUNCE_MS);
  }

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.page.set(0);
    this.load();
  }

  updateKindFilter(value: string): void {
    this.kindFilter.set(value as KindFilter);
    this.page.set(0);
    this.load();
  }

  updateFromDate(value: string): void {
    this.fromDate.set(value);
    this.page.set(0);
    this.load();
  }

  updateToDate(value: string): void {
    this.toDate.set(value);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  statusTone(status: OrderStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeOrderStatus(status).tone;
  }

  kindLabel(kind: OrderKind): string {
    return orderKindLabel(kind);
  }

  /** True when any filter narrows the list (distinguishes "no orders yet" from "no matches"). */
  hasActiveFilters(): boolean {
    return (
      this.search().trim() !== '' ||
      this.statusFilter() !== 'todos' ||
      this.kindFilter() !== 'todos' ||
      this.fromDate() !== '' ||
      this.toDate() !== ''
    );
  }

  private load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    const status = this.statusFilter();
    const kind = this.kindFilter();
    this.request = this.ordersService
      .list({
        q: this.search(),
        status: status === 'todos' ? null : status,
        kind: kind === 'todos' ? null : kind,
        from: this.fromDate() || null,
        to: this.toDate() || null,
        page: this.page(),
      })
      .subscribe({
        next: (result) => {
          this.orders.set(result.content);
          this.totalPages.set(result.totalPages);
          this.totalElements.set(result.totalElements);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
