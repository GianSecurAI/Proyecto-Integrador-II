import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { OrderStatusTimelineComponent } from '../../../../shared/ui/order-status-timeline/order-status-timeline.component';
import { AdminOrderViewModel, getAllowedNextStatuses } from '../../models/admin-order.model';
import { AdminOrdersMockService, AdminOrdersMockState } from '../../services/admin-orders-mock.service';
import { OrderStatus, describeOrderStatus } from '../../../account/models/order.model';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Staff order-detail screen (`/admin/orders/:id`) — RF-13 ("Gestión de los estados del pedido")
 * and RF-14 ("Historial de cambios de estado del pedido", same append-only history rendering
 * `OrderDetailPage` already established). Reached from `AdminOrderListPage`.
 *
 * Reuses `shared/ui/order-status-timeline` AS-IS (the exact same component the customer-facing
 * order-detail/order-tracking screens already share) rather than building a second visual
 * timeline — see that component's own doc comment for why it is the single source of truth for
 * the status -> step mapping. Also mirrors `OrderDetailPage`'s append-only history-list rendering
 * for the full previous -> new / date / responsible / note change log.
 *
 * The status-transition `<select>` is populated ONLY with `getAllowedNextStatuses(order.status)`
 * (`../../models/admin-order.model.ts`) — never a free choice of all six statuses — and an
 * optional note maps directly onto `HistorialEstadoPedido.nota`
 * (`OrderStatusHistoryEntryViewModel.note`). Submitting calls
 * `AdminOrdersMockService.transitionStatus`, which independently re-validates the transition
 * (defense in depth).
 *
 * `:id` is read reactively from `route.paramMap` (not just once at construction), same
 * "navigating between two detail routes reuses this component instance" reasoning as
 * `OrderDetailPage`/`AdminProductDetailPage`. An unknown id is a REAL not-found state;
 * `?mockState=error` simulates a generic fetch failure instead.
 */
@Component({
  selector: 'app-admin-order-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    OrderStatusTimelineComponent,
  ],
  templateUrl: './admin-order-detail.page.html',
  styleUrl: './admin-order-detail.page.scss',
})
export class AdminOrderDetailPage {
  private readonly ordersService = inject(AdminOrdersMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly order = signal<AdminOrderViewModel | null>(null);

  readonly selectedNextStatus = signal<OrderStatus | null>(null);
  readonly transitionNote = signal('');
  readonly transitioning = signal(false);
  readonly transitionError = signal<string | null>(null);
  readonly transitionSuccess = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  private currentId = '';

  readonly allowedNextStatuses = computed(() => {
    const current = this.order();
    return current ? getAllowedNextStatuses(current.status) : [];
  });

  readonly canTransition = computed(() => this.allowedNextStatuses().length > 0);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(params.get('id') ?? '');
    });
  }

  retry(): void {
    this.load(this.currentId);
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  statusTone(status: OrderStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeOrderStatus(status).tone;
  }

  updateSelectedNextStatus(value: string): void {
    this.selectedNextStatus.set((value || null) as OrderStatus | null);
  }

  updateTransitionNote(value: string): void {
    this.transitionNote.set(value);
  }

  submitTransition(): void {
    const current = this.order();
    const nextStatus = this.selectedNextStatus();
    if (!current || !nextStatus || this.transitioning()) return;

    this.transitioning.set(true);
    this.transitionError.set(null);
    this.transitionSuccess.set(null);
    const note = this.transitionNote().trim() || null;

    this.ordersService
      .transitionStatus(current.id, nextStatus, note)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.transitioning.set(false);
          this.order.set(updated);
          this.selectedNextStatus.set(null);
          this.transitionNote.set('');
          this.transitionSuccess.set('El estado del pedido se actualizó correctamente.');
        },
        error: () => {
          this.transitioning.set(false);
          this.transitionError.set(
            'No pudimos actualizar el estado del pedido. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    const mockState: AdminOrdersMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.selectedNextStatus.set(null);
    this.transitionNote.set('');
    this.transitionError.set(null);
    this.transitionSuccess.set(null);
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
