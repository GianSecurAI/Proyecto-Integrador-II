import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { AuthService } from '../../services/auth.service';

/**
 * "Continue with email" screen (spec User Story 1 Scenarios 1 & 3; FR-001, FR-004).
 *
 * T028 (US1): the base request flow.
 * T044 (US3): the 429 throttle message below is deliberately worded exactly like every other
 *   outcome of this same request — see the comment on `errorMessage` handling.
 *
 * Deliberately has no password field, no "sign in with Google" button, and no per-email
 * "this account already exists" branching in its success state — the Figma Login screen
 * showing password + OAuth is an explicit CONFLICT (Constitution Principle XV) and is not
 * reproduced here; and inferring existence at this step would defeat the anti-enumeration
 * guarantee the backend is providing (FR-004). This component only renders whatever generic
 * `message` the backend returned — it does not compose its own "may reveal existence" wording.
 */
@Component({
  selector: 'app-request-code-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './request-code.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class RequestCodePage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    // Validators.email/required are a UX convenience only; the backend independently validates
    // the email format at the API boundary regardless of what passes here (Prohibited Practice
    // #6 — client-side validation is never trusted as sufficient).
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  readonly submitting = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  get emailControl() {
    return this.form.controls.email;
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.emailControl.value.trim();
    this.submitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.authService.requestOtp(email).subscribe({
      next: (response) => {
        this.submitting.set(false);
        // Displaying the backend's own generic acknowledgment verbatim (rather than composing
        // our own copy) guarantees this screen never accidentally says anything more specific
        // than what FR-004 allows, no matter which branch the server took internally.
        this.successMessage.set(response.message);
        this.router.navigate(['/auth/verify-code'], { state: { email } });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const apiError = err.error as ApiError | undefined;

        if (err.status === 400) {
          this.errorMessage.set(apiError?.message ?? 'Ingresa un correo electrónico válido.');
        } else if (err.status === 429) {
          // Same generic wording regardless of the underlying reason (own throttle vs. any
          // other cause) — the backend's message is already generic by contract (FR-012), and
          // this branch must not add any hint on top of it (US3/T044, spec Edge Cases).
          this.errorMessage.set(
            apiError?.message ??
              'Has alcanzado el límite de solicitudes. Inténtalo de nuevo más tarde.',
          );
        } else {
          this.errorMessage.set('Ocurrió un error. Inténtalo de nuevo.');
        }
      },
    });
  }
}
