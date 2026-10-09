import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import {
  AdminQuotation,
  QuotationStatus,
  describeQuotationStatus,
} from '../../models/admin-quotation.model';
import { AdminQuotationsService } from '../../services/admin-quotations.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Quotation detail (`/admin/quotations/:id`, ASESOR and ADMINISTRADOR): the agreed price and customer, the status
 * changes the server allows (RF-09) and, for an accepted quotation, the generation of its personalized order once
 * the external payment is confirmed (RF-11, RN08). The allowed next statuses come from the server, never from here.
 */
@Component({
  selector: 'app-admin-quotation-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-quotation-detail.page.html',
  styleUrl: './admin-quotation-detail.page.scss',
})
export class AdminQuotationDetailPage {
  private readonly quotations = inject(AdminQuotationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly quotation = signal<AdminQuotation | null>(null);
  readonly notes = signal('');
  readonly paymentConfirmed = signal(false);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  private currentId = 0;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(Number(params.get('id')));
    });
  }

  retry(): void {
    this.load(this.currentId);
  }

  statusLabel(status: QuotationStatus): string {
    return describeQuotationStatus(status).label;
  }

  statusTone(status: QuotationStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeQuotationStatus(status).tone;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
  }

  changeStatus(next: QuotationStatus): void {
    const current = this.quotation();
    if (!current || this.busy()) return;
    this.run(this.quotations.changeStatus(current.id, next, this.notes().trim() || undefined));
  }

  generateOrder(): void {
    const current = this.quotation();
    if (!current || this.busy() || !this.paymentConfirmed()) return;
    this.run(this.quotations.generateOrder(current.id, true));
  }

  private run(call: ReturnType<AdminQuotationsService['changeStatus']>): void {
    this.busy.set(true);
    this.actionError.set(null);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.quotation.set(updated);
        this.notes.set('');
        this.paymentConfirmed.set(false);
        this.busy.set(false);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.actionError.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: unknown): string {
    switch (apiErrorCode(err)) {
      case 'INVALID_QUOTATION_TRANSITION':
        this.retry();
        return 'La cotización cambió mientras la editabas o ese cambio ya no es posible. Se recargó su estado.';
      case 'QUOTATION_NOT_ACCEPTED':
        return 'Solo una cotización aceptada puede generar un pedido.';
      case 'QUOTATION_ALREADY_ORDERED':
        this.retry();
        return 'Esta cotización ya generó su pedido.';
      case 'VALIDATION_FAILED':
        return 'El servidor rechazó los datos. Revisa las notas e inténtalo de nuevo.';
      default:
        return httpStatus(err) === 429
          ? rateLimitMessage(err)
          : 'No pudimos completar la acción. Inténtalo de nuevo más tarde.';
    }
  }

  private load(id: number): void {
    this.currentId = id;
    if (!Number.isInteger(id) || id <= 0) {
      this.status.set('not-found');
      return;
    }
    this.status.set('loading');
    this.quotations
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quotation) => {
          this.quotation.set(quotation);
          this.status.set('loaded');
        },
        error: (err: unknown) => {
          this.quotation.set(null);
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
