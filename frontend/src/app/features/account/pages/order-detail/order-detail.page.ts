import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { OrderDetailViewModel, OrderStatus, describeOrderStatus } from '../../models/order.model';
import { CustomerOrdersMockService, OrdersMockState } from '../../services/customer-orders-mock.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Order-detail screen, reached by clicking an order in `OrderHistoryPage` (`/account/orders/:id`).
 * Same requirement grounding as `OrderHistoryPage` (RF-05/RF-12), plus RF-14 ("Historial de
 * cambios de estado del pedido", docs/discovery/06-system-definition.md line 63, "Confirmado")
 * for the append-only status-history timeline rendered here. See
 * `../../mocks/customer-orders.mock.ts` for the full provenance/assumption trail.
 *
 * Subscribes directly to `route.paramMap` in the constructor (same
 * async-subscribe-in-constructor idiom as `ProfilePage`/`CatalogPage`, and the same reason
 * `ProductDetailPage` reads its route param reactively): navigating from one order to another
 * while already on `/account/orders/:id` reuses this component instance, so the fetch must react
 * to `:id` changing, not just run once at construction. `?mockState=` is read from the query
 * string at the moment of each fetch (`route.snapshot.queryParamMap`) rather than also being
 * reactive — only `:id` reactivity is load-bearing here.
 *
 * The "not found" state is reached for real (not simulated) by navigating to any id absent from
 * the mock data — same convention `ProductDetailPage` already uses for an unknown catalog id.
 * `?mockState=error` simulates a generic fetch failure instead, distinct from "not found".
 *
 * Repurchase ("Volver a comprar") is UI-representation only, mirroring
 * `ProductDetailPage.previewAction()` exactly: it sets a signal that shows a demo-only message
 * and performs no real cart/checkout action (Constitution Prohibited Practice #5 — no business
 * decision is made here). It is only offered for `kind === 'estandar'` orders — RF-06
 * ("Recompra desde historial") is explicitly ambiguous for personalized orders per
 * `docs/discovery/01-requirements-analysis.md` line 310, so no repurchase affordance is rendered
 * for a `personalizado` order at all (not merely disabled).
 *
 * Also renders `shared/ui/order-status-timeline` (the ordered Pendiente→Entregado step view,
 * with a distinct treatment for `cancelado`) ABOVE the plain append-only history list below —
 * added, not swapped in, so the full previous→new/date/responsible/note change log stays intact
 * here. The new public `features/order-tracking/pages/track-order` screen renders the same
 * timeline component for the same reason: both screens showing order-status progression should
 * look identical (single source of truth for the vocabulary/status→step mapping).
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
  private readonly ordersService = inject(CustomerOrdersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly order = signal<OrderDetailViewModel | null>(null);
  private readonly repurchaseRequestedFor = signal<string | null>(null);

  private currentId = '';

  readonly repurchaseMessage = computed(() =>
    this.repurchaseRequestedFor() === this.order()?.id
      ? 'Vista de demostración. La recompra todavía no está disponible.'
      : '',
  );

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

  requestRepurchase(): void {
    const current = this.order();
    if (current && current.kind === 'estandar') {
      this.repurchaseRequestedFor.set(current.id);
    }
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
    const mockState: OrdersMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.repurchaseRequestedFor.set(null);
    this.ordersService
      .getOrderById(id, mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.status.set('loaded');
        },
        error: () => {
          this.order.set(null);
          this.status.set(mockState === 'error' ? 'error' : 'not-found');
        },
      });
  }
}
