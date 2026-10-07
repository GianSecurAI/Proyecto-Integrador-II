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
import { apiErrorCode, httpStatus, withRateLimit } from '../../../../core/models/api-error.model';
import { orderKindLabel } from '../../../../shared/models/wire-enums';
import { AdminOrderViewModel } from '../../models/admin-order.model';
import { AdminOrdersService } from '../../services/admin-orders.service';
import { OrderKind, OrderStatus, describeOrderStatus } from '../../../account/models/order.model';

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
 * The status-transition `<select>` is populated ONLY with the server's `allowedNextStatuses` for
 * this order (`GET /api/admin/orders/{id}`) — the frontend holds no copy of the lifecycle rules.
 * Submitting calls `PATCH /api/admin/orders/{id}/status` with an optional note (max 500 chars);
 * `409 INVALID_STATUS_TRANSITION` (re-sent status, concurrent change) reloads the order so the
 * offered statuses are current. The server records the acting staff member in the history.
 *
 * `:id` is read reactively from `route.paramMap` (navigating between two detail routes reuses
 * this component instance). `404` is the not-found state; other failures show a retry.
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
  private readonly ordersService = inject(AdminOrdersService);
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

  /** Exactly the transitions the SERVER reported as currently allowed (`allowedNextStatuses`);
   * the frontend never evaluates the lifecycle rules itself. */
  readonly allowedNextStatuses = computed(() => this.order()?.allowedNextStatuses ?? []);

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

  kindLabel(kind: OrderKind): string {
    return `Pedido ${orderKindLabel(kind).toLowerCase()}`;
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
      .changeStatus(current.id, nextStatus, note)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.transitioning.set(false);
          this.order.set(updated);
          this.selectedNextStatus.set(null);
          this.transitionNote.set('');
          this.transitionSuccess.set('El estado del pedido se actualizó correctamente.');
        },
        error: (err: unknown) => {
          this.transitioning.set(false);
          if (apiErrorCode(err) === 'INVALID_STATUS_TRANSITION') {
            // Someone else changed the order first (or the move is not allowed): reload the server
            // state so the offered next statuses are current again.
            this.transitionError.set(
              'Ese cambio de estado ya no es válido (el pedido pudo haber cambiado). Mostramos el estado actual.',
            );
            this.reloadQuietly(current.id);
          } else if (httpStatus(err) === 404) {
            this.transitionError.set('El pedido ya no existe.');
          } else if (apiErrorCode(err) === 'VALIDATION_FAILED') {
            this.transitionError.set('El servidor rechazó el cambio (revisa la nota, máx. 500 caracteres).');
          } else {
            this.transitionError.set(
              withRateLimit(err, 'No pudimos actualizar el estado del pedido. Inténtalo de nuevo más tarde.'),
            );
          }
        },
      });
  }

  private reloadQuietly(id: string): void {
    this.ordersService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.selectedNextStatus.set(null);
        },
        error: () => undefined,
      });
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    this.status.set('loading');
    this.selectedNextStatus.set(null);
    this.transitionNote.set('');
    this.transitionError.set(null);
    this.transitionSuccess.set(null);
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
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
