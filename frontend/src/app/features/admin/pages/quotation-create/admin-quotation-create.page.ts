import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { applyFieldErrors, serverError } from '../../../../core/errors/form-errors';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { QUOTATION_LIMITS } from '../../models/admin-quotation.model';
import { AdminQuotationsService } from '../../services/admin-quotations.service';

interface QuotationControls {
  customerEmail: FormControl<string>;
  description: FormControl<string>;
  agreedAmount: FormControl<number | null>;
  notes: FormControl<string>;
}

/**
 * Registers a quotation the advisor agreed with a customer over WhatsApp (RF-08, RN06/RN07). The amount is typed
 * by staff: the system never calculates a price for personalized printing.
 */
@Component({
  selector: 'app-admin-quotation-create-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CardComponent, ButtonComponent, FormFieldComponent],
  templateUrl: './admin-quotation-create.page.html',
  styleUrl: './admin-quotation-create.page.scss',
})
export class AdminQuotationCreatePage {
  private readonly quotations = inject(AdminQuotationsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<QuotationControls>({
    customerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(QUOTATION_LIMITS.emailMax)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(QUOTATION_LIMITS.descriptionMax)],
    }),
    agreedAmount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(QUOTATION_LIMITS.amountMax)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(QUOTATION_LIMITS.notesMax)],
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
  get notesControl() {
    return this.form.controls.notes;
  }

  submit(): void {
    if (this.submitting()) return;
    this.customerEmailControl.setValue(this.customerEmailControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.quotations
      .create({
        customerEmail: raw.customerEmail,
        description: raw.description.trim(),
        agreedAmount: raw.agreedAmount as number,
        notes: raw.notes.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quotation) => {
          this.submitting.set(false);
          void this.router.navigate(['/admin/quotations', quotation.id]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.messageFor(err));
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/admin/quotations']);
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
      return 'Ese correo pertenece a una cuenta de personal o desactivada: no se puede registrar una cotización a su nombre.';
    }
    if (httpStatus(err) === 429) return rateLimitMessage(err);
    return 'No pudimos registrar la cotización. Inténtalo de nuevo más tarde.';
  }
}
