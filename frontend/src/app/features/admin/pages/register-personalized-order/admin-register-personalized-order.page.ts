import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AdminOrdersMockService } from '../../services/admin-orders-mock.service';

interface RegisterPersonalizedOrderControls {
  customerEmail: FormControl<string>;
  quotationDescription: FormControl<string>;
  quotationAmount: FormControl<number | null>;
  paymentConfirmed: FormControl<boolean>;
}

/**
 * Advisor workflow screen (`/admin/orders/register-personalized`) — RF-11 ("Registro de
 * pedidos", "Confirmado para el flujo personalizado", actor Asesor/Administrador) and RF-10
 * ("Registro y gestión de cotización", "Confirmado como registro administrativo posterior al
 * acuerdo por WhatsApp"). Reached from `AdminOrderListPage`'s page-header action.
 *
 * Implements CLAUDE.md's "Business clarification: purchasing flows" §"Custom / personalized
 * products" steps 4-6 EXACTLY: the advisor has already coordinated the sale over WhatsApp and the
 * customer has already paid through the business's external payment mechanism BEFORE this screen
 * is used — this form only records that fact and the manually-agreed quotation, it never
 * processes a payment itself (there is no payment field, no payment-provider reference, no
 * payment-gateway call of any kind anywhere in this page or its service call) and it never
 * calculates a price (`quotationAmount` is a plain, manually-typed positive number — line 96 of
 * `docs/discovery/06-system-definition.md`: "el monto de una Cotización siempre es un dato manual
 * del asesor").
 *
 * `paymentConfirmed` is a required attestation checkbox ("Confirmo que el pago externo ya fue
 * recibido"), validated like any other required control (accessible error feedback via
 * `app-form-field`), grounded by line 95: "el sistema confía en la afirmación humana, no valida
 * el pago."
 *
 * Client-side validation here (required email in valid format, required description, positive
 * amount, required checkbox) is a UX convenience only — Constitution Prohibited Practice #6 — no
 * real backend endpoint exists yet for this mock-only preview feature.
 *
 * On a successful (mock) registration, navigates straight to the new order's detail page
 * (`/admin/orders/:id`), mirroring `AdminProductCreatePage`'s create-and-redirect convention.
 */
@Component({
  selector: 'app-admin-register-personalized-order-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CardComponent, ButtonComponent, FormFieldComponent],
  templateUrl: './admin-register-personalized-order.page.html',
  styleUrl: './admin-register-personalized-order.page.scss',
})
export class AdminRegisterPersonalizedOrderPage {
  private readonly ordersService = inject(AdminOrdersMockService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<RegisterPersonalizedOrderControls>({
    customerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    quotationDescription: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quotationAmount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    paymentConfirmed: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  get customerEmailControl() {
    return this.form.controls.customerEmail;
  }
  get quotationDescriptionControl() {
    return this.form.controls.quotationDescription;
  }
  get quotationAmountControl() {
    return this.form.controls.quotationAmount;
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
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.ordersService
      .registerPersonalizedOrder({
        customerEmail: raw.customerEmail,
        quotationDescription: raw.quotationDescription.trim(),
        quotationAmount: raw.quotationAmount!,
        paymentConfirmed: raw.paymentConfirmed,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.router.navigate(['/admin/orders', created.id]);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set(
            'No pudimos registrar el pedido personalizado. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/admin/orders']);
  }
}
