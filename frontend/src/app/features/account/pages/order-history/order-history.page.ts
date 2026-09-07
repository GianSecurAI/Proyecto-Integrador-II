import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerOrdersMockService, OrdersMockState } from '../../services/customer-orders-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * RF-05 ("Consulta de historial de pedidos", docs/discovery/06-system-definition.md line 54) and
 * RF-12 ("Consulta y seguimiento del estado del pedido", line 61), both "Confirmado". No
 * `spec.md` exists for orders yet and no backend `Pedido` entity exists at all — see
 * `../../mocks/customer-orders.mock.ts`'s doc comment for the full provenance/assumption trail.
 * Entirely frontend-only preview, mirroring `ProfilePage`'s mock-service pattern; no Figma frame
 * covers this screen at all (the only order-related frame, "Seguimiento" node 2:1993, is an
 * unauthenticated guest ID-search box — a different use case, out of scope here per the
 * orchestrator brief), so this reuses the existing light-theme design system
 * (`app-card`, `_tokens.scss`) like `ProfilePage` does.
 *
 * `?mockState=empty` / `?mockState=error` query params let a reviewer deterministically preview
 * every async state from the browser URL bar alone (see the on-screen notice in
 * order-history.page.html) — default is the populated mock list. Subscribing directly to
 * `route.queryParamMap` in the constructor (rather than an Angular `effect()`) mirrors the
 * existing async-subscribe-in-constructor idiom already used by `ProfilePage`/`CatalogPage`.
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
  private readonly ordersService = inject(CustomerOrdersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly orders = signal<OrderSummaryViewModel[]>([]);

  private currentMockState: OrdersMockState = 'populated';

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const value = params.get('mockState');
        this.currentMockState = value === 'empty' || value === 'error' ? value : 'populated';
        this.load(this.currentMockState);
      });
  }

  retry(): void {
    this.load(this.currentMockState);
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  private load(mockState: OrdersMockState): void {
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
