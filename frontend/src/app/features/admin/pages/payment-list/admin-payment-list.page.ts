import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { rateLimitMessage, httpStatus } from '../../../../core/models/api-error.model';
import {
  CHECKOUT_STATUSES,
  CheckoutStatus,
  describeCheckoutStatus,
  paymentMethodLabel,
  PaymentMethod,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { PaymentSummaryDto } from '../../models/admin-payment.model';
import { AdminPaymentsService } from '../../services/admin-payments.service';

type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * FE-11 "Pagos por verificar" (ADMINISTRADOR only, ADR-005): the queue of checkouts with a
 * payment proof, `GET /api/admin/payments`. Status filter (default `PROOF_SUBMITTED`) and paging
 * are applied by the server, which also orders oldest proof first; a badge flags a screenshot
 * that was already used on another checkout.
 */
@Component({
  selector: 'app-admin-payment-list-page',
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
  templateUrl: './admin-payment-list.page.html',
  styleUrl: './admin-payment-list.page.scss',
})
export class AdminPaymentListPage {
  private readonly payments = inject(AdminPaymentsService);

  readonly status = signal<LoadStatus>('loading');
  readonly items = signal<PaymentSummaryDto[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly statusFilter = signal<CheckoutStatus>('PROOF_SUBMITTED');
  readonly errorMessage = signal<string | null>(null);

  readonly statusOptions: readonly CheckoutStatus[] = CHECKOUT_STATUSES;

  private request: Subscription | null = null;

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  retry(): void {
    this.load();
  }

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as CheckoutStatus);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  statusLabel(status: CheckoutStatus): string {
    return describeCheckoutStatus(status).label;
  }

  statusTone(status: CheckoutStatus) {
    return describeCheckoutStatus(status).tone;
  }

  methodLabel(method: PaymentMethod | null): string {
    return method ? paymentMethodLabel(method) : '—';
  }

  formatDate(iso: string | null): string {
    return iso ? this.dateFormatter.format(new Date(iso)) : '—';
  }

  private load(): void {
    this.request?.unsubscribe();
    this.status.set('loading');
    this.errorMessage.set(null);
    this.request = this.payments.list({ status: this.statusFilter(), page: this.page() }).subscribe({
      next: (result) => {
        this.items.set(result.content);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.status.set('loaded');
      },
      error: (err: unknown) => {
        this.errorMessage.set(httpStatus(err) === 429 ? rateLimitMessage(err) : null);
        this.status.set('error');
      },
    });
  }
}
