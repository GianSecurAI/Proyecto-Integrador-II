import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { orderKindLabel } from '../../../../shared/models/wire-enums';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { CheckoutStateService } from '../../../checkout/state/checkout-state.service';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { OrderKind, OrderSummaryViewModel } from '../../models/order.model';
import { CustomerOrdersService } from '../../services/customer-orders.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * RF-05 / RF-12: the signed-in customer's order history, backed by `GET /api/orders`. The server
 * returns only the caller's own orders (newest first) and pages the result; this page just shows
 * one server page at a time (prev/next). Loading, empty and error (retry) states are real.
 */
@Component({
  selector: 'app-order-history-page',
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
  ],
  templateUrl: './order-history.page.html',
  styleUrl: './order-history.page.scss',
})
export class OrderHistoryPage {
  private readonly ordersService = inject(CustomerOrdersService);
  /** Checkout started in this session and not yet finished (shows the "pago pendiente" banner). */
  readonly pendingCheckoutId = inject(CheckoutStateService).pendingCheckoutId;

  readonly status = signal<LoadStatus>('loading');
  readonly orders = signal<OrderSummaryViewModel[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  private request: Subscription | null = null;

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  retry(): void {
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  kindLabel(kind: OrderKind): string {
    return `Pedido ${orderKindLabel(kind).toLowerCase()}`;
  }

  private load(): void {
    this.request?.unsubscribe();
    this.status.set('loading');
    this.request = this.ordersService.list({ page: this.page() }).subscribe({
      next: (result) => {
        this.orders.set(result.content);
        this.totalPages.set(result.totalPages);
        this.status.set('loaded');
      },
      error: () => this.status.set('error'),
    });
  }
}
