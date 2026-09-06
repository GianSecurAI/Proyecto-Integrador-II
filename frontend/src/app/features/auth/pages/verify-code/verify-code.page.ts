import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { AuthService } from '../../services/auth.service';

/**
 * "Enter code" screen (spec User Story 1 Scenarios 2 & 4; FR-003, FR-004a, FR-005–FR-011).
 *
 * T029 (US1): base verify flow + success redirect to the authenticated placeholder page.
 * T038 (US2): the 401/410 inline rejection messages below.
 *
 * The `accountStatus` field is the *only* place in this whole flow allowed to say "created" vs.
 * "existing" (FR-004a) — it is rendered verbatim from what the backend decided, never inferred
 * or guessed client-side.
 */
@Component({
  selector: 'app-verify-code-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './verify-code.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class VerifyCodePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Populated from router navigation state set by RequestCodePage on success. Verifying a code
  // is meaningless without knowing which email it was issued for, so if this screen is reached
  // directly (e.g. a bookmarked URL, or a hard refresh that lost navigation state) there is no
  // safe action other than sending the user back to request a fresh code.
  email: string | null = null;

  readonly form = new FormGroup({
    // Format-only UX validation (6 numeric digits) — mirrors, but never replaces, the backend's
    // own authoritative check of the code's validity/expiry/attempt count (Prohibited Practice
    // #6). A malformed code is still submitted to and rejected by the backend the same way any
    // other incorrect code is (spec Edge Cases), so this is purely to save the user a round
    // trip for an obviously-wrong format, not a security control.
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  readonly submitting = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  get codeControl() {
    return this.form.controls.code;
  }

  ngOnInit(): void {
    const state = history.state as { email?: string } | null;
    this.email = state?.email ?? null;

    if (!this.email) {
      this.router.navigate(['/auth/request-code']);
    }
  }

  submit(): void {
    if (this.form.invalid || this.submitting() || !this.email) {
      this.form.markAllAsTouched();
      return;
    }

    const code = this.codeControl.value.trim();
    const email = this.email;
    this.submitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.authService.verifyOtp(email, code).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.successMessage.set(
          response.accountStatus === 'created'
            ? '¡Cuenta creada! Bienvenido a Ar Makers 3D.'
            : '¡Bienvenido de nuevo!',
        );
        this.router.navigate(['/account']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const apiError = err.error as ApiError | undefined;

        if (err.status === 401) {
          this.errorMessage.set(
            apiError?.message ??
              'El código ingresado es incorrecto. Verifica e inténtalo de nuevo.',
          );
        } else if (err.status === 410) {
          this.errorMessage.set(
            apiError?.message ?? 'Este código no es válido o ha expirado. Solicita uno nuevo.',
          );
        } else if (err.status === 429) {
          this.errorMessage.set(
            apiError?.message ?? 'Has alcanzado el límite de intentos. Solicita un nuevo código.',
          );
        } else if (err.status === 400) {
          this.errorMessage.set(apiError?.message ?? 'Ingresa un código válido de 6 dígitos.');
        } else {
          this.errorMessage.set('Ocurrió un error. Inténtalo de nuevo.');
        }
      },
    });
  }

  requestNewCode(): void {
    this.router.navigate(['/auth/request-code']);
  }
}
