import { Component, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { CHECKOUT_LIMITS, DeliveryInfoFormValue } from '../../models/checkout-form.model';
import { CheckoutStateService } from '../../state/checkout-state.service';

/**
 * Checkout step 3 of 4 — delivery information. Deliberately minimal (address line + district +
 * optional delivery notes) per this feature's explicit scope note — no structured multi-field
 * address system, no Peru-districts dropdown/lookup. Maps to the order request's `delivery.*`.
 *
 * Same "read initial value from `CheckoutStateService`, write back before advancing" pattern as
 * `CustomerInfoStepComponent` — see that component's doc comment.
 */
@Component({
  selector: 'app-checkout-delivery-info-step',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, FormFieldComponent],
  templateUrl: './delivery-info-step.component.html',
  styleUrl: './delivery-info-step.component.scss',
})
export class DeliveryInfoStepComponent {
  private readonly checkoutState = inject(CheckoutStateService);

  readonly back = output<void>();
  readonly next = output<void>();

  readonly form = new FormGroup({
    // Limits mirror `the checkout request DTO.Delivery` (UX only — the backend re-validates).
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CHECKOUT_LIMITS.address)],
    }),
    district: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CHECKOUT_LIMITS.district)],
    }),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(CHECKOUT_LIMITS.notes)],
    }),
  });

  get addressControl() {
    return this.form.controls.address;
  }
  get districtControl() {
    return this.form.controls.district;
  }
  get notesControl() {
    return this.form.controls.notes;
  }

  constructor() {
    const saved = this.checkoutState.deliveryInfo();
    if (saved) {
      this.form.setValue(saved);
    }
  }

  submit(): void {
    this.addressControl.setValue(this.addressControl.value.trim());
    this.districtControl.setValue(this.districtControl.value.trim());
    this.notesControl.setValue(this.notesControl.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value: DeliveryInfoFormValue = this.form.getRawValue();
    this.checkoutState.setDeliveryInfo(value);
    this.next.emit();
  }

  goBack(): void {
    this.checkoutState.setDeliveryInfo(this.form.getRawValue());
    this.back.emit();
  }
}
