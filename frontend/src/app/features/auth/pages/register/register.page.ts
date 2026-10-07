import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AuthService } from '../../services/auth.service';
import { requestOtpErrorMessage } from '../../utils/otp-error-messages';

/** Local, page-only form model (not a wire type; `AuthService.requestOtp` builds the request). */
interface RegisterFormValue {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/**
 * FR-001 amendment (spec.md, "Amendment (2026-09-07, Product Owner decision)"): a pre-OTP
 * "create account" step that collects an email plus optional profile fields (first name, last
 * name, phone), then funnels into the exact same email-OTP flow as request-code.page.ts
 * (`POST /api/auth/otp/request`, which accepts the optional fields and applies them only if the
 * account is created). No password field exists here or anywhere in this feature (Constitution
 * Principle VI, NON-NEGOTIABLE). The response stays generic and identical whether or not the email
 * exists (FR-004); blank optional fields are omitted from the request. Client checks are UX-only.
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FormFieldComponent],
  templateUrl: './register.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup<{ [K in keyof RegisterFormValue]: FormControl<string> }>({
    // UX format checks only; production validation belongs to the future integration.
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    // Optional profile fields (spec.md Amendment): never required, never persisted client-side.
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', {
      nonNullable: true,
      // Loose, academic-project-appropriate shape; Validators.pattern is a no-op on an empty
      // value, so this never makes the field required.
      validators: [Validators.pattern(/^[0-9+\-\s()]{6,20}$/)],
    }),
  });
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  get emailControl() {
    return this.form.controls.email;
  }
  get firstNameControl() {
    return this.form.controls.firstName;
  }
  get lastNameControl() {
    return this.form.controls.lastName;
  }
  get phoneControl() {
    return this.form.controls.phone;
  }

  constructor() {
    this.auth.reset();
    this.destroyRef.onDestroy(() => this.form.reset());
  }

  submit(): void {
    if (this.submitting()) return;
    this.emailControl.setValue(this.emailControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    // The optional profile fields travel WITH the OTP request (backend `OtpRequestDto` accepts
    // firstName/lastName/phone and applies them only if the account gets created); blanks are
    // omitted by `AuthService`. The server re-validates all of them.
    this.auth
      .requestOtp(this.emailControl.value, {
        firstName: this.firstNameControl.value,
        lastName: this.lastNameControl.value,
        phone: this.phoneControl.value,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset();
          void this.router.navigate(['/auth/verify-code'], { queryParamsHandling: 'preserve' });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(requestOtpErrorMessage(err));
        },
      });
  }
}
