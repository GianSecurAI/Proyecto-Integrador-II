import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AUTH_PREVIEW } from '../../services/auth-preview.service';

/** RF-01/RF-02, FR-001/FR-004: OTP visual preview adapted from Figma 2:672. */
@Component({
  selector: 'app-request-code-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, FormFieldComponent],
  templateUrl: './request-code.page.html',
  styleUrls: ['../../auth-shared.css'],
})
export class RequestCodePage {
  private readonly auth = inject(AUTH_PREVIEW);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    // UX format checks only; production validation belongs to the future integration.
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  get emailControl() {
    return this.form.controls.email;
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
