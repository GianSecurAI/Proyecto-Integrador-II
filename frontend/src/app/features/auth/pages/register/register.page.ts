import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AUTH_PREVIEW } from '../../services/auth-preview.service';

/**
 * Local, page-only form model. Deliberately NOT a `Cliente`/persistence model: the optional
 * fields here are never sent anywhere beyond this component (see submit()) and must not be
 * reused as, or conflated with, any future customer profile domain type (RF-04, out of scope).
 */
interface RegisterFormValue {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/**
 * FR-001 amendment (spec.md, "Amendment (2026-09-07, Product Owner decision)"): a pre-OTP
 * "create account" step that collects an email plus optional profile fields (first name, last
 * name, phone), then funnels into the exact same email-OTP flow as request-code.page.ts. No
 * password field exists here or anywhere in this feature (Constitution Principle VI,
 * NON-NEGOTIABLE). Optional fields are UX-only convenience: they are never persisted (no
 * localStorage, no console logging) and are never sent to the auth preview service, whose
 * `requestOtp(email?: string)` contract intentionally only concerns itself with the email
 * (FR-004: the response must stay generic and identical whether or not they were filled in).
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FormFieldComponent],
  templateUrl: './register.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class RegisterPage {
  private readonly auth = inject(AUTH_PREVIEW);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup<{ [K in keyof RegisterFormValue]: FormControl<string> }>({
    // UX format checks only; production validation belongs to the future integration.
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    // Optional profile fields (spec.md Amendment): never required, never persisted, never sent
    // to the backend/mock beyond this component.
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
    // Only the email ever leaves this component — optional fields are UX-only and are
    // intentionally dropped here, never forwarded to the auth preview (see class doc).
    this.auth
      .requestOtp(this.emailControl.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset();
          void this.router.navigate(['/auth/verify-code']);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('No pudimos continuar. Inténtalo de nuevo más tarde.');
        },
      });
  }
}
