import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take, timer } from 'rxjs';
import { AppRole, defaultRouteForRole } from '../../../../core/auth/roles';
import { safeReturnUrl } from '../../../../core/guards/return-url';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AuthService } from '../../services/auth.service';
import { requestOtpErrorMessage, verifyOtpErrorMessage } from '../../utils/otp-error-messages';

/** UX pacing for the resend button only; the real OTP rate limit is enforced by the backend (429). */
const RESEND_COOLDOWN_SECONDS = 30;

/** FR-003: code entry screen backed by `POST /api/auth/otp/verify`; validity/expiry are the backend's decisions. */
@Component({
  selector: 'app-verify-code-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FormFieldComponent],
  templateUrl: './verify-code.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class VerifyCodePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
      next: ({ role }) => {
        this.submitting.set(false);
        this.completed.set(true);
        // `AuthService.verifyOtp` already recorded the server-reported identity (role/email/id
        // from `GET /api/auth/me`) in `SessionStateService`; this only completes the login by
        // navigating somewhere real.
        this.navigateAfterLogin(role);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(err));
      },
    });
  }

  /**
   * Honors an explicit `returnUrl` (set by `authGuard` — `core/guards/auth.guard.ts` — when it
   * redirected an unauthenticated visitor here) so completing login sends them back to what they
   * originally tried to reach; otherwise falls back to `defaultRouteForRole`'s sensible per-role
   * landing page. Pure navigation UX, not an authorization decision: whichever route is navigated
   * to still independently re-checks access via its own guard.
   */
  private navigateAfterLogin(role: AppRole): void {
    const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    void this.router.navigateByUrl(returnUrl ?? defaultRouteForRole(role));
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
        error: (err: unknown) => {
          this.resending.set(false);
          this.errorMessage.set(requestOtpErrorMessage(err));
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
    return verifyOtpErrorMessage(err);
  }
}
