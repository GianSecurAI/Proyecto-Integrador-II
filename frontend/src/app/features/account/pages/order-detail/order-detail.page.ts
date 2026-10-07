import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { OrderStatusTimelineComponent } from '../../../../shared/ui/order-status-timeline/order-status-timeline.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { httpStatus } from '../../../../core/models/api-error.model';
import { orderKindLabel } from '../../../../shared/models/wire-enums';
import {
  OrderDetailViewModel,
  OrderKind,
  OrderStatus,
  describeOrderStatus,
} from '../../models/order.model';
import { CustomerOrdersService } from '../../services/customer-orders.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Order-detail screen (`/account/orders/:id`), RF-05/RF-12/RF-14, backed by
 * `GET /api/orders/{id}`: the owner's order with its items, server-computed total, delivery data,
 * current status and the append-only `statusHistory`. `:id` is read reactively from
 * `route.paramMap` (navigating from one order to another reuses this component instance).
 *
 * A `404` means the order does not exist OR belongs to another customer — the API deliberately does
 * not tell them apart — and shows the "not found" state; any other failure shows a retry. There is
 * no repurchase action (RF-06 is not part of the backend contract) and no demo notice.
 */
@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    AccountNavComponent,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    OrderStatusBadgeComponent,
    OrderStatusTimelineComponent,
  ],
  templateUrl: './order-detail.page.html',
  styleUrl: './order-detail.page.scss',
})
export class OrderDetailPage {
  private readonly ordersService = inject(CustomerOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly order = signal<OrderDetailViewModel | null>(null);

  private currentId = '';

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(params.get('id') ?? '');
    });
  }

  retry(): void {
    this.load(this.currentId);
  }

  kindLabel(kind: OrderKind): string {
    return `Pedido ${orderKindLabel(kind).toLowerCase()}`;
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  /** Human-readable Spanish label for a status value — reuses the same lookup as
   * `OrderStatusBadgeComponent` so the timeline and the badge never disagree on wording. */
  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    this.status.set('loading');
    this.ordersService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.status.set('loaded');
        },
        error: (err: unknown) => {
          this.order.set(null);
          // 404 = unknown id OR another customer's order (indistinguishable by design).
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
