import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take, timer } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AUTH_PREVIEW, AuthPreviewError } from '../../services/auth-preview.service';

/** Preview-only resend cooldown (UX pacing), unrelated to any real OTP rate limit. */
const RESEND_COOLDOWN_SECONDS = 30;

/** FR-003 visual step only: no OTP validity/expiry rules or real session permissions. */
@Component({
  selector: 'app-verify-code-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FormFieldComponent],
  templateUrl: './verify-code.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class VerifyCodePage implements OnInit {
  private readonly auth = inject(AUTH_PREVIEW);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly resending = signal(false);
  /** Seconds remaining before "Solicitar otro código" is clickable again; 0 = ready. */
  readonly resendCooldown = signal(0);
  readonly resendLabel = computed(() => {
    const remaining = this.resendCooldown();
    if (remaining <= 0) return 'Solicitar otro código';
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `Reenviar en ${minutes}:${seconds.toString().padStart(2, '0')}`;
  });
  get codeControl() {
    return this.form.controls.code;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.form.reset();
      this.auth.reset();
    });
  }

  ngOnInit(): void {
    if (!this.auth.hasPendingRequest()) void this.router.navigate(['/auth/request-code']);
  }

  submit(): void {
    if (this.submitting() || this.completed()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const response = this.auth.verifyOtp(this.codeControl.value);
    this.form.reset();
    response.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.completed.set(true);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(err));
      },
    });
  }

  /**
   * In-place resend: re-triggers the preview request without navigating away (navigating back
   * to the email step remains the back arrow's distinct job, see verify-code.page.html).
   */
  requestNewCode(): void {
    if (this.submitting() || this.resending() || this.resendCooldown() > 0) return;
    this.resending.set(true);
    this.errorMessage.set(null);
    this.auth
      .requestOtp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resending.set(false);
          this.startResendCooldown();
        },
        error: () => {
          this.resending.set(false);
          this.errorMessage.set('No pudimos reenviar el código. Inténtalo de nuevo más tarde.');
        },
      });
  }

  private startResendCooldown(): void {
    this.resendCooldown.set(RESEND_COOLDOWN_SECONDS);
    timer(1000, 1000)
      .pipe(take(RESEND_COOLDOWN_SECONDS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resendCooldown.update((seconds) => Math.max(seconds - 1, 0)));
  }

  private resolveErrorMessage(err: unknown): string {
    if (err instanceof AuthPreviewError) {
      if (err.reason === 'expired') return 'Este código expiró. Solicita uno nuevo.';
      if (err.reason === 'invalid') return 'El código ingresado no es válido.';
    }
    return 'No pudimos verificar el código. Inténtalo de nuevo o solicita otro.';
  }
}
