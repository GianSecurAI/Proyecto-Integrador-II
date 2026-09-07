import { Component, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CustomerInfoFormValue } from '../../models/checkout-form.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * Checkout step 2 of 4 — customer information. A reactive form whose validation is UX-convenience
 * only (Constitution Prohibited Practice #6 — never advertised as sufficient on its own; no real
 * backend endpoint exists yet for this frontend-only mock checkout).
 *
 * Guest checkout: reachable with no prior login (`/cart` and `/checkout` are both unguarded
 * routes). If `SessionStateService.currentEmail()` is already set (the visitor happens to be
 * signed in), the email field is PRE-FILLED but stays fully editable/confirmable — never
 * read-only — matching this feature's "pre-fill-and-confirm when known, plain provide when not"
 * requirement.
 *
 * Reads its initial values from `CheckoutStateService` (so returning to this step after going
 * forward, then back, shows exactly what was already typed) and writes back to it before
 * advancing — this component holds no disconnected copy of checkout state beyond the live
 * `FormGroup` itself.
 */
@Component({
  selector: 'app-checkout-customer-info-step',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, FormFieldComponent],
  templateUrl: './customer-info-step.component.html',
  styleUrl: './customer-info-step.component.scss',
})
export class CustomerInfoStepComponent {
  private readonly checkoutState = inject(CheckoutStateService);
  private readonly session = inject(SessionStateService);

  readonly back = output<void>();
  readonly next = output<void>();

  readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    // Required (unlike the optional phone in `RegisterFormValue`) — a standard order needs a way
    // to reach the customer about delivery. Same loose, academic-project-appropriate shape.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[0-9+\-\s()]{6,20}$/)],
    }),
  });

  get fullNameControl() {
    return this.form.controls.fullName;
  }
  get emailControl() {
    return this.form.controls.email;
  }
  get phoneControl() {
    return this.form.controls.phone;
  }

  constructor() {
    const saved = this.checkoutState.customerInfo();
    if (saved) {
      this.form.setValue(saved);
      return;
    }
    const prefillEmail = this.session.currentEmail();
    if (prefillEmail) {
      this.emailControl.setValue(prefillEmail);
    }
  }

  submit(): void {
    this.fullNameControl.setValue(this.fullNameControl.value.trim());
    this.emailControl.setValue(this.emailControl.value.trim());
    this.phoneControl.setValue(this.phoneControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value: CustomerInfoFormValue = this.form.getRawValue();
    this.checkoutState.setCustomerInfo(value);
    this.next.emit();
  }

  goBack(): void {
    this.checkoutState.setCustomerInfo(this.form.getRawValue());
    this.back.emit();
  }
}
