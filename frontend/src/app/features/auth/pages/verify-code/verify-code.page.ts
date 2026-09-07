import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AUTH_PREVIEW } from '../../services/auth-preview.service';

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
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set(
          'No pudimos verificar el código. Inténtalo de nuevo o solicita otro.',
        );
      },
    });
  }

  requestNewCode(): void {
    if (!this.submitting()) void this.router.navigate(['/auth/request-code']);
  }
}
