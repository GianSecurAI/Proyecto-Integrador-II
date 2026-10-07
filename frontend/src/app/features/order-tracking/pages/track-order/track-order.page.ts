import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { httpStatus } from '../../../../core/models/api-error.model';
import { orderKindLabel } from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { OrderStatusTimelineComponent } from '../../../../shared/ui/order-status-timeline/order-status-timeline.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import {
  OrderDetailViewModel,
  OrderKind,
  OrderStatus,
  describeOrderStatus,
} from '../../../account/models/order.model';
import { CustomerOrdersService } from '../../../account/services/customer-orders.service';

type TrackStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

/**
 * Order-tracking lookup (RF-12, "Consulta y seguimiento del estado del pedido") — Figma
 * "Seguimiento" frame (node `2:1993`): "Rastrea tu pedido" card with an "ID DE PEDIDO" input.
 *
 * INTEGRATION CHANGE: the backend has NO public tracking endpoint (decision D-07,
 * docs/architecture/provisional-decisions.md PD-ORD-15): `GET /api/orders/{id}` requires the
 * owner's CLIENTE session, and an id that does not exist or belongs to someone else is the same
 * 404. So this route is now behind `authGuard` (CLIENTE) and the lookup shows the signed-in
 * customer's own order with its server `statusHistory`; typing someone else's id simply yields
 * "not found". The checkout confirmation links here with `?orderId=` as a pre-fill convenience
 * (never auto-submitted). The status vocabulary and view models are shared with
 * `features/account` (`order.model.ts`, `CustomerOrdersService`) — one source, no second mock.
 */
@Component({
  selector: 'app-track-order-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    FormFieldComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    OrderStatusTimelineComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './track-order.page.html',
  styleUrl: './track-order.page.scss',
})
export class TrackOrderPage {
  private readonly ordersService = inject(CustomerOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = new FormGroup({
    // UX-only requirement check; the mock service's real lookup is what actually decides
    // "found"/"not found" (Constitution Prohibited Practice #6 — no client-side validation is
    // treated as sufficient on its own).
    orderId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly status = signal<TrackStatus>('idle');
  readonly order = signal<OrderDetailViewModel | null>(null);

  private lastSubmittedId = '';

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  get orderIdControl() {
    return this.form.controls.orderId;
  }

  constructor() {
    // Convenience pre-fill only, never auto-submitted — a visitor arriving from
    // `features/checkout/pages/confirmation/checkout-confirmation.page.ts`'s "Rastrear mi
    // pedido" link still has to press the lookup button themselves, same as anyone typing an id
    // by hand. `orderId` here is a non-secret order identifier, not the kind of sensitive data
    // the "avoid sensitive data in URL/query parameters" rule is about.
    const prefillId = this.route.snapshot.queryParamMap.get('orderId');
    if (prefillId) {
      this.orderIdControl.setValue(prefillId);
    }
  }

  submit(): void {
    if (this.status() === 'loading') return;
    this.orderIdControl.setValue(this.orderIdControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.lastSubmittedId = this.orderIdControl.value;
    this.load(this.lastSubmittedId);
  }

  retry(): void {
    if (this.lastSubmittedId) this.load(this.lastSubmittedId);
  }

  /** Returns to the idle search form without a full page reload, clearing the previous result. */
  reset(): void {
    this.status.set('idle');
    this.order.set(null);
    this.form.reset();
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  /** Reuses the same lookup as `describeOrderStatus` so this screen and the authenticated order
   * screens never disagree on wording. */
  kindLabel(kind: OrderKind): string {
    return `Pedido ${orderKindLabel(kind).toLowerCase()}`;
  }

  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  badgeFor(status: OrderStatus): { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' } {
    return describeOrderStatus(status);
  }

  private load(id: string): void {
    this.status.set('loading');
    this.order.set(null);
    this.ordersService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.status.set('found');
        },
        error: (err: unknown) => {
          this.order.set(null);
          // 404 = unknown id OR an order that belongs to another customer (by design the API does
          // not tell them apart, and there is no public tracking endpoint — decision D-07).
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
