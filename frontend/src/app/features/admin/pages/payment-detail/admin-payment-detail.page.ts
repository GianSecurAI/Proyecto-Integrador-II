import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';
import {
  describeCheckoutStatus,
  describeProofDecision,
  paymentMethodLabel,
  PaymentMethod,
  ProofDecision,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { ProofImageComponent } from '../../../../shared/ui/proof-image/proof-image.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminConfirmDialogComponent } from '../../components/admin-confirm-dialog/admin-confirm-dialog.component';
import { PaymentDetailDto, REJECTION_REASON_MAX } from '../../models/admin-payment.model';
import { AdminPaymentsService } from '../../services/admin-payments.service';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * FE-11 payment verification detail (ADMINISTRADOR only, ADR-005): customer contact, amount and
 * reference to compare with the wallet app, items, every proof attempt, the screenshot (blob via
 * credentials -> object URL, no external host) and the two decisions.
 *
 * The page only forwards the administrator's decision: `POST .../approve` (creates the order on
 * the server — the resulting `orderId` is shown) and `POST .../reject` (reason 1..300). Which
 * decisions are offered mirrors the server status (`PROOF_SUBMITTED`) as a UX hint; the server
 * decides and answers 409 `CHECKOUT_STATE_CONFLICT` when someone else already did (the page then
 * reloads). The real verification (amount, reference, receiving account vs. the Yape/Plin app)
 * is done by the administrator, never by this screen.
 */
@Component({
  selector: 'app-admin-payment-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
    ProofImageComponent,
    AdminConfirmDialogComponent,
  ],
  templateUrl: './admin-payment-detail.page.html',
  styleUrl: './admin-payment-detail.page.scss',
})
export class AdminPaymentDetailPage {
  private readonly payments = inject(AdminPaymentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly reasonMax = REJECTION_REASON_MAX;

  readonly status = signal<LoadStatus>('loading');
  readonly payment = signal<PaymentDetailDto | null>(null);
  readonly selectedAttemptId = signal<string | null>(null);

  readonly approveDialogOpen = signal(false);
  readonly rejectFormOpen = signal(false);
  readonly reason = signal('');
  readonly submitting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly approvedOrderId = signal<string | null>(null);

  readonly reasonLength = computed(() => this.reason().length);
  readonly reasonValid = computed(() => {
    const trimmed = this.reason().trim();
    return trimmed.length >= 1 && trimmed.length <= REJECTION_REASON_MAX;
  });
  /** UX hint mirroring the server state machine; the server enforces it (409). */
  readonly canDecide = computed(() => this.payment()?.status === 'PROOF_SUBMITTED');

  /** New function instance whenever the viewed attempt changes, which makes the viewer reload. */
  readonly proofLoader = computed<(() => Observable<Blob>) | null>(() => {
    const attemptId = this.selectedAttemptId();
    const id = this.currentId();
    return attemptId ? () => this.payments.proofImage(id, attemptId) : null;
  });

  private readonly currentId = signal('');

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentId.set(params.get('id') ?? '');
      this.load();
    });
  }

  retry(): void {
    this.load();
  }

  statusBadge(status: PaymentDetailDto['status']) {
    return describeCheckoutStatus(status);
  }

  decisionBadge(decision: ProofDecision) {
    return describeProofDecision(decision);
  }

  methodLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  formatDate(iso: string | null): string {
    return iso ? this.dateFormatter.format(new Date(iso)) : '—';
  }

  formatSize(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  selectAttempt(attemptId: string): void {
    this.selectedAttemptId.set(attemptId);
  }

  openApprove(): void {
    this.actionError.set(null);
    this.approveDialogOpen.set(true);
  }

  closeApprove(): void {
    this.approveDialogOpen.set(false);
  }

  toggleReject(): void {
    this.actionError.set(null);
    this.rejectFormOpen.update((open) => !open);
  }

  updateReason(value: string): void {
    this.reason.set(value);
  }

  approve(): void {
    if (this.submitting()) return;
    this.approveDialogOpen.set(false);
    this.run(this.payments.approve(this.currentId()), (updated) => {
      this.approvedOrderId.set(updated.orderId);
    });
  }

  reject(): void {
    if (this.submitting() || !this.reasonValid()) return;
    this.run(this.payments.reject(this.currentId(), this.reason()), () => {
      this.rejectFormOpen.set(false);
      this.reason.set('');
      this.approvedOrderId.set(null);
    });
  }

  private run(call: Observable<PaymentDetailDto>, onSuccess: (updated: PaymentDetailDto) => void): void {
    this.submitting.set(true);
    this.actionError.set(null);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.setPayment(updated);
        onSuccess(updated);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.actionError.set(this.decisionErrorMessage(err));
        if (apiErrorCode(err) === 'CHECKOUT_STATE_CONFLICT') this.load(true);
      },
    });
  }

  private decisionErrorMessage(err: unknown): string {
    const status = httpStatus(err);
    const code = apiErrorCode(err);
    if (status === 429) return rateLimitMessage(err);
    if (code === 'CHECKOUT_STATE_CONFLICT') {
      return 'El pago ya cambió de estado (otra decisión o una cancelación). Actualizamos la información.';
    }
    if (code === 'VALIDATION_FAILED') {
      return 'El motivo no es válido: escribe entre 1 y 300 caracteres, sin caracteres de control.';
    }
    if (status === 404) return 'No encontramos este pago.';
    return 'No se pudo registrar la decisión. Inténtalo de nuevo.';
  }

  private load(keepMessages = false): void {
    const id = this.currentId();
    if (!keepMessages) this.status.set('loading');
    this.payments
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => this.setPayment(payment),
        error: (err: unknown) => this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error'),
      });
  }

  private setPayment(payment: PaymentDetailDto): void {
    this.payment.set(payment);
    this.status.set('loaded');
    const attempts = payment.attempts;
    const selected = this.selectedAttemptId();
    if (!selected || !attempts.some((a) => a.attemptId === selected)) {
      this.selectedAttemptId.set(attempts.length > 0 ? attempts[attempts.length - 1].attemptId : null);
    }
  }
}
