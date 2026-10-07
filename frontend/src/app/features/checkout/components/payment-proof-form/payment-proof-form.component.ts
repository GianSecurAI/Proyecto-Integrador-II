import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../../environments/environment';
import { apiErrorCode } from '../../../../core/models/api-error.model';
import {
  PAYMENT_METHODS,
  PaymentMethod,
  paymentMethodLabel,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CheckoutDto } from '../../models/checkout.model';
import { CheckoutService } from '../../services/checkout.service';
import { proofUploadErrorMessage } from '../../utils/checkout-error-messages';
import { PROOF_ACCEPT, validateOperationCode, validateProofFile } from '../../utils/proof-file';

/**
 * QR images of the business wallets: STATIC ASSETS shipped with the SPA.
 * PLACEHOLDER: the files in `public/assets/payments/` are generated stand-ins that say
 * "Reemplazar con el QR real". The business MUST replace them with its real Yape/Plin QR before
 * going live (OPS-02, docs/architecture/payments-qr-assets.md). If the replacement uses another
 * extension (e.g. .png), update these two paths.
 */
export const PAYMENT_QR_IMAGES: Record<PaymentMethod, string> = {
  YAPE: '/assets/payments/yape-qr.svg',
  PLIN: '/assets/payments/plin-qr.svg',
};

/**
 * Payment step of the standard checkout (ADR-005, FE-04): amount and reference exactly as the
 * server returned them, Yape/Plin tabs with the QR, instructions in Spanish and the proof
 * upload (`POST /api/checkout/{id}/proof`, multipart). File type/size and the operation-code
 * format are checked here for UX only; the server decides (type by bytes, 5 MB, structure,
 * attempts, state). The component never decides that a payment succeeded.
 */
@Component({
  selector: 'app-payment-proof-form',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './payment-proof-form.component.html',
  styleUrl: './payment-proof-form.component.scss',
})
export class PaymentProofFormComponent {
  private readonly checkoutService = inject(CheckoutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly checkout = input.required<CheckoutDto>();
  /** Emits the updated checkout returned by the server after a successful upload. */
  readonly uploaded = output<CheckoutDto>();
  /** Emits when the server says the checkout is no longer in an uploadable state (409). */
  readonly stale = output<void>();

  readonly accept = PROOF_ACCEPT;
  readonly qrImages = PAYMENT_QR_IMAGES;
  readonly accounts = environment.paymentAccounts;
  readonly showPlaceholderWarning = !environment.production;

  readonly methods = computed<readonly PaymentMethod[]>(() => {
    const offered = this.checkout().paymentInstructions.methods;
    return PAYMENT_METHODS.filter((m) => offered.includes(m));
  });
  readonly selectedMethod = signal<PaymentMethod>('YAPE');
  readonly operationCode = signal('');
  readonly operationCodeError = computed(() => validateOperationCode(this.operationCode()));

  readonly file = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly uploading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canSubmit = computed(
    () =>
      !this.uploading() &&
      this.file() !== null &&
      this.fileError() === null &&
      this.operationCodeError() === null,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  methodLabel(method: PaymentMethod): string {
    return paymentMethodLabel(method);
  }

  account(method: PaymentMethod): { holderName: string; phoneNumber: string } {
    return method === 'YAPE' ? this.accounts.yape : this.accounts.plin;
  }

  selectMethod(method: PaymentMethod): void {
    if (this.uploading()) return;
    this.selectedMethod.set(method);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.item(0) ?? null;
    this.revokePreview();
    this.errorMessage.set(null);
    if (!chosen) {
      this.file.set(null);
      this.fileError.set(null);
      return;
    }
    const problem = validateProofFile(chosen);
    this.fileError.set(problem);
    if (problem) {
      this.file.set(null);
      input.value = '';
      return;
    }
    this.file.set(chosen);
    this.previewUrl.set(URL.createObjectURL(chosen));
  }

  clearFile(input: HTMLInputElement): void {
    input.value = '';
    this.revokePreview();
    this.file.set(null);
    this.fileError.set(null);
  }

  onCodeInput(value: string): void {
    this.operationCode.set(value);
  }

  submit(): void {
    const file = this.file();
    if (!file || !this.canSubmit()) return;
    this.uploading.set(true);
    this.errorMessage.set(null);
    this.checkoutService
      .uploadProof(this.checkout().checkoutId, file, this.selectedMethod(), this.operationCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.uploading.set(false);
          this.revokePreview();
          this.file.set(null);
          this.operationCode.set('');
          this.uploaded.emit(updated);
        },
        error: (err: unknown) => {
          this.uploading.set(false);
          this.errorMessage.set(proofUploadErrorMessage(err));
          const code = apiErrorCode(err);
          if (code === 'CHECKOUT_STATE_CONFLICT' || code === 'PROOF_ATTEMPTS_EXCEEDED') {
            this.stale.emit();
          }
        },
      });
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }
}
