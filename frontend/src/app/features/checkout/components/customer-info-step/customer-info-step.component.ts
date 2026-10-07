import { Component, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CHECKOUT_LIMITS, CustomerInfoFormValue } from '../../models/checkout-form.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * Checkout step 2 of 4 — contact information (`contact.fullName`, `contact.phone` of the order
 * request). Validation is UX-only and mirrors `the checkout request DTO` (the backend re-validates).
 *
 * The checkout now requires a signed-in CLIENTE (`/checkout` is behind `authGuard`; the backend
 * rejects anonymous order creation), so the customer's EMAIL is the account email reported by the
 * session — shown read-only for confirmation and never sent in the order request.
 *
 * Reads its initial values from `CheckoutStateService` and writes back before advancing, so
 * navigating forward and back never loses what was typed.
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
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CHECKOUT_LIMITS.fullName)],
    }),
    // Required: a standard order needs a way to reach the customer about delivery.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(CHECKOUT_LIMITS.phoneRegex)],
    }),
  });

  get fullNameControl() {
    return this.form.controls.fullName;
  }
  get phoneControl() {
    return this.form.controls.phone;
  }

  /** Account email from the session (read-only, informational). */
  readonly accountEmail = this.session.currentEmail;

  constructor() {
    const saved = this.checkoutState.customerInfo();
    if (saved) {
      this.form.setValue(saved);
    }
  }

  submit(): void {
    this.fullNameControl.setValue(this.fullNameControl.value.trim());
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
