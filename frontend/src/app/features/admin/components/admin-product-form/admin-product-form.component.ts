import { Component, effect, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { applyFieldErrors, serverError } from '../../../../core/errors/form-errors';
import { categoryLabel, ProductCategory } from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import {
  EMPTY_PRODUCT_FORM_VALUE,
  PRODUCT_FORM_CATEGORIES,
  PRODUCT_LIMITS,
  ProductFormValue,
  splitCharacteristics,
} from '../../models/admin-product.model';

interface ProductFormControls {
  title: FormControl<string>;
  category: FormControl<ProductCategory>;
  subcategory: FormControl<string>;
  description: FormControl<string>;
  price: FormControl<number | null>;
  characteristics: FormControl<string>;
}

/** UX mirror of the backend limits on the characteristics list (<= 20 items of <= 200 chars). */
function characteristicsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const items = splitCharacteristics(control.value ?? '');
  if (items.length > PRODUCT_LIMITS.characteristicsMaxItems) return { tooManyItems: true };
  if (items.some((item) => item.length > PRODUCT_LIMITS.characteristicMax)) return { itemTooLong: true };
  return null;
}

/**
 * Shared create/edit product form (`AdminProductCreatePage`, `AdminProductDetailPage`). Fields map
 * 1:1 onto the backend `ProductWriteRequestDto` (title, category, subcategory, description, price,
 * characteristics) — the Figma/mock-only compare-at price and personalizable flag are gone because
 * the backend has neither. Validation here is UX only and mirrors the DTO limits; the parent shows
 * the server's `400 VALIDATION_FAILED` messages on the matching field through `applyServerErrors`.
 * Emits intent only (`submitted` / `cancelled`); the parent talks to the API.
 */
@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, FormFieldComponent],
  templateUrl: './admin-product-form.component.html',
  styleUrl: './admin-product-form.component.scss',
})
export class AdminProductFormComponent {
  readonly initialValue = input<ProductFormValue>(EMPTY_PRODUCT_FORM_VALUE);
  readonly submitting = input(false);
  readonly submitLabel = input('Guardar producto');
  readonly showCancel = input(true);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<ProductFormValue>();
  readonly cancelled = output<void>();

  readonly categories = PRODUCT_FORM_CATEGORIES;
  readonly categoryLabel = categoryLabel;
  readonly limits = PRODUCT_LIMITS;
  readonly serverError = serverError;

  readonly form = new FormGroup<ProductFormControls>({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PRODUCT_LIMITS.titleMax)],
    }),
    category: new FormControl<ProductCategory>('LLAVERO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    subcategory: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PRODUCT_LIMITS.subcategoryMax)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(PRODUCT_LIMITS.descriptionMax)],
    }),
    price: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(0.01),
        Validators.max(PRODUCT_LIMITS.priceMax),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    }),
    characteristics: new FormControl('', {
      nonNullable: true,
      validators: [characteristicsValidator],
    }),
  });

  get titleControl() {
    return this.form.controls.title;
  }
  get categoryControl() {
    return this.form.controls.category;
  }
  get subcategoryControl() {
    return this.form.controls.subcategory;
  }
  get descriptionControl() {
    return this.form.controls.description;
  }
  get priceControl() {
    return this.form.controls.price;
  }
  get characteristicsControl() {
    return this.form.controls.characteristics;
  }

  constructor() {
    // Re-fills the form whenever the parent hands over a new `initialValue` reference (initial
    // fetch, and every "cancel editing" reset).
    effect(() => {
      const value = this.initialValue();
      this.form.reset({
        title: value.title,
        category: value.category,
        subcategory: value.subcategory,
        description: value.description,
        price: value.price,
        characteristics: value.characteristics,
      });
    });
  }

  /** Shows a backend `400 VALIDATION_FAILED` on the matching controls; returns the messages that
   * could not be attached to a control. */
  applyServerErrors(err: unknown): string[] {
    return applyFieldErrors(this.form, err);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const value: ProductFormValue = {
      title: raw.title.trim(),
      category: raw.category,
      subcategory: raw.subcategory.trim(),
      description: raw.description.trim(),
      price: raw.price!,
      characteristics: raw.characteristics,
    };
    this.submitted.emit(value);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.cancelled.emit();
  }
}
