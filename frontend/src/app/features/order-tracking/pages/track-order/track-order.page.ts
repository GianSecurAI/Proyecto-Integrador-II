import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { OrderStatusTimelineComponent } from '../../../../shared/ui/order-status-timeline/order-status-timeline.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import {
  OrderDetailViewModel,
  OrderStatus,
  describeOrderStatus,
} from '../../../account/models/order.model';
import {
  CustomerOrdersMockService,
  OrdersMockState,
} from '../../../account/services/customer-orders-mock.service';

type TrackStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

/**
 * Public, unauthenticated order-tracking screen (RF-12, "Consulta y seguimiento del estado del
 * pedido") — Figma "Seguimiento" frame (fileKey `e1l878xWPLq1W1KVJ0wHrx`, node `2:1993`), a
 * dark-background "Rastrea tu pedido" card with an "ID DE PEDIDO" input and an "Estado del
 * seguimiento" submit button. This is a DIFFERENT entry point from the authenticated customer's
 * own order list (`features/account/pages/order-history`/`order-detail`, behind `authGuard`):
 * here any visitor types an order id and looks it up, with no login required, matching the
 * business reality that a customer may want to check status from a link/email without signing
 * in again.
 *
 * Reuses the SAME status vocabulary, mock data source and view models as the authenticated order
 * screens (`features/account/models/order.model.ts`, `features/account/services/
 * customer-orders-mock.service.ts`) — deliberately NOT a second, competing mock "database" for
 * the same domain concept. `getOrderById`'s "not found" case is a REAL state reachable by typing
 * any id absent from the seed (e.g. any id other than `PED-2031`, `PED-2044`, `PED-2050`,
 * `PED-2012`, `PED-2061`); `?mockState=error` on this page's own URL forces the generic failure
 * state instead, for preview purposes only (documented on-screen), same convention as
 * `order-detail.page.ts`.
 *
 * No shipping/delivery section is rendered — `DireccionEnvio` is explicitly not modeled yet
 * (docs/discovery/06-system-definition.md line 147). No incident/report-issue action either —
 * the Figma frame contains no such affordance.
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
  private readonly ordersService = inject(CustomerOrdersMockService);
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
  statusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  badgeFor(status: OrderStatus): { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' } {
    return describeOrderStatus(status);
  }

  private load(id: string): void {
    const mockState: OrdersMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.order.set(null);
    this.ordersService
      .getOrderById(id, mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.status.set('found');
        },
        error: () => {
          this.order.set(null);
          this.status.set(mockState === 'error' ? 'error' : 'not-found');
        },
      });
  }
}
