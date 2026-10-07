import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { applyFieldErrors, serverError } from '../../../../core/errors/form-errors';
import { IdempotencyAttempt } from '../../../../core/http/idempotency-attempt';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { PERSONALIZED_LIMITS } from '../../models/admin-order.model';
import { AdminOrdersService } from '../../services/admin-orders.service';

interface RegisterPersonalizedOrderControls {
  customerEmail: FormControl<string>;
  description: FormControl<string>;
  agreedAmount: FormControl<number | null>;
  paymentConfirmed: FormControl<boolean>;
}

/**
 * RF-11 (staff registration of a personalized order, CLAUDE.md "Custom / personalized products"
 * steps 6-8), backed by `POST /api/admin/orders/personalized`. The quotation and the payment
 * happened OUTSIDE the system (WhatsApp + the business's external payment): staff only records
 * the customer's email, a description, the agreed amount (entered by staff — nothing is
 * calculated) and confirms that the external payment was received. No payment is processed here.
 *
 * Client validation mirrors the backend DTO for UX only; the server re-validates everything and a
 * `400 VALIDATION_FAILED` is shown on the matching field. An `Idempotency-Key` UUID makes a retry
 * of the same submission safe (a double click or lost response replays the original order).
 * `409 CUSTOMER_NOT_ELIGIBLE` means the email belongs to a staff or deactivated account.
 */
@Component({
  selector: 'app-admin-register-personalized-order-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CardComponent, ButtonComponent, FormFieldComponent],
  templateUrl: './admin-register-personalized-order.page.html',
  styleUrl: './admin-register-personalized-order.page.scss',
})
export class AdminRegisterPersonalizedOrderPage {
  private readonly ordersService = inject(AdminOrdersService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly attempt = new IdempotencyAttempt();

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<RegisterPersonalizedOrderControls>({
    customerEmail: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(PERSONALIZED_LIMITS.emailMax),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PERSONALIZED_LIMITS.descriptionMax)],
    }),
    agreedAmount: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(0.01),
        Validators.max(PERSONALIZED_LIMITS.amountMax),
      ],
    }),
    paymentConfirmed: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  readonly serverError = serverError;

  get customerEmailControl() {
    return this.form.controls.customerEmail;
  }
  get descriptionControl() {
    return this.form.controls.description;
  }
  get agreedAmountControl() {
    return this.form.controls.agreedAmount;
  }
  get paymentConfirmedControl() {
    return this.form.controls.paymentConfirmed;
  }

  submit(): void {
    if (this.submitting()) return;
    this.customerEmailControl.setValue(this.customerEmailControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const value = {
      customerEmail: raw.customerEmail,
      description: raw.description.trim(),
      agreedAmount: raw.agreedAmount,
      paymentConfirmed: raw.paymentConfirmed,
    };
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.ordersService
      .registerPersonalized(value, this.attempt.keyFor(value))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ order }) => {
          this.submitting.set(false);
          this.attempt.reset();
          void this.router.navigate(['/admin/orders', order.id]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.messageFor(err));
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/admin/orders']);
  }

  private messageFor(err: unknown): string {
    const code = apiErrorCode(err);
    if (code === 'VALIDATION_FAILED') {
      const unmatched = applyFieldErrors(this.form, err);
      return unmatched.length > 0
        ? `El servidor rechazó los datos: ${unmatched.join('; ')}`
        : 'Revisa los campos marcados e inténtalo de nuevo.';
    }
    if (code === 'CUSTOMER_NOT_ELIGIBLE') {
      return 'Ese correo pertenece a una cuenta de personal o desactivada: no se puede registrar un pedido a su nombre.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      this.attempt.reset();
      return 'No pudimos completar el envío. Inténtalo de nuevo.';
    }
    if (httpStatus(err) === 429) return rateLimitMessage(err);
    return 'No pudimos registrar el pedido personalizado. Inténtalo de nuevo más tarde.';
  }
}
