import { Component, computed, inject, input, signal } from '@angular/core';
import {
  describeProofDecision,
  paymentMethodLabel,
  PaymentMethod,
  ProofDecision,
} from '../../../../shared/models/wire-enums';
import { ProofImageComponent } from '../../../../shared/ui/proof-image/proof-image.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { CheckoutAttemptDto } from '../../models/checkout.model';
import { CheckoutService } from '../../services/checkout.service';

/**
 * The customer's own proof attempts (method, date, decision, rejection reason) and an on-demand
 * viewer for each screenshot. Images come from `GET /api/checkout/{id}/proof/{attemptId}` (owner
 * only, with credentials) as blob object URLs.
 */
@Component({
  selector: 'app-checkout-attempts',
  standalone: true,
  imports: [StatusBadgeComponent, ProofImageComponent],
  templateUrl: './checkout-attempts.component.html',
  styleUrl: './checkout-attempts.component.scss',
})
export class CheckoutAttemptsComponent {
  private readonly checkoutService = inject(CheckoutService);

  readonly checkoutId = input.required<string>();
  readonly attempts = input.required<readonly CheckoutAttemptDto[]>();

  readonly openAttemptId = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  /** New function instance whenever the viewed attempt changes, which makes the viewer reload. */
  readonly loader = computed(() => {
    const attemptId = this.openAttemptId();
    const checkoutId = this.checkoutId();
    return () => this.checkoutService.proofImage(checkoutId, attemptId ?? '');
  });

  toggle(attemptId: string): void {
    this.openAttemptId.update((current) => (current === attemptId ? null : attemptId));
  }

  badge(decision: ProofDecision) {
    return describeProofDecision(decision);
  }

  method(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  formatDate(iso: string): string {
    return this.dateFormatter.format(new Date(iso));
  }
}
