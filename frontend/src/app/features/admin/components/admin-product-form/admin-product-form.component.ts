import { Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { CATALOG_CATEGORY_LABELS, CatalogCategory } from '../../../catalog/models/catalog-filters.model';
import {
  EMPTY_PRODUCT_FORM_VALUE,
  PRODUCT_FORM_CATEGORIES,
  ProductFormValue,
} from '../../models/admin-product.model';

/** Reactive form shape backing the `FormGroup` below — every control is non-nullable so
 * `getRawValue()` matches `ProductFormValue` directly (mirrors `ProfilePage`'s
 * `{ [K in keyof ProfileFormValue]: FormControl<...> }` typing convention), except `price`/
 * `compareAtPrice` which stay nullable while empty so `Validators.required` can reject an
 * unfilled price. */
interface ProductFormControls {
  title: FormControl<string>;
  category: FormControl<Exclude<CatalogCategory, 'todo'>>;
  subcategory: FormControl<string>;
  description: FormControl<string>;
  price: FormControl<number | null>;
  compareAtPrice: FormControl<number | null>;
  personalizable: FormControl<boolean>;
  characteristics: FormControl<string>;
}

/**
 * Shared, presentational create/edit reactive form for `AdminProductCreatePage` and
 * `AdminProductDetailPage`'s edit mode — factored out because both call sites need the exact same
 * moderate-sized field set (title, category, subcategory, description, price, compareAtPrice,
 * personalizable, characteristics) and duplicating it would be meaningful duplication (8 fields +
 * validation), unlike e.g. a two-field form. Deliberately excludes `available` — see
 * `ProductFormValue`'s doc comment: availability is a separate, dedicated,
 * confirmation-gated control (`AdminConfirmDialogComponent`), never part of this form.
 *
 * Client-side validation here (required title/category/subcategory/description, price > 0) is a
 * UX convenience only — mirrors, never replaces, server-side validation (Constitution Prohibited
 * Practice #6); no real backend endpoint exists yet for this mock-only preview feature.
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
  /** Generic submission error to render inline (e.g. a failed mock create/update) — this
   * component never talks to a service itself, the parent page owns the HTTP/mock call. */
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<ProductFormValue>();
  readonly cancelled = output<void>();

  readonly categories = PRODUCT_FORM_CATEGORIES;
  readonly categoryLabels = CATALOG_CATEGORY_LABELS;

  readonly form = new FormGroup<ProductFormControls>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl<Exclude<CatalogCategory, 'todo'>>('llavero', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    subcategory: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    price: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    compareAtPrice: new FormControl<number | null>(null, { validators: [Validators.min(0.01)] }),
    personalizable: new FormControl(false, { nonNullable: true }),
    characteristics: new FormControl('', { nonNullable: true }),
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
  get compareAtPriceControl() {
    return this.form.controls.compareAtPrice;
  }
  get characteristicsControl() {
    return this.form.controls.characteristics;
  }

  constructor() {
    // Re-fills the form whenever the parent hands over a new `initialValue` reference — the
    // initial fetch (create page's static default, or detail page's `toProductFormValue(product)`
    // once loaded) and every subsequent "cancel editing" reset (the parent re-passes the same
    // computed value, unchanged), mirroring `ProfilePage.startEditing()`'s pre-fill/`cancel()`'s
    // revert, but expressed as reactive re-fill since this is a signal `input()`, not a
    // constructor-only value.
    effect(() => {
      const value = this.initialValue();
      this.form.reset({
        title: value.title,
        category: value.category,
        subcategory: value.subcategory,
        description: value.description,
        price: value.price,
        compareAtPrice: value.compareAtPrice,
        personalizable: value.personalizable,
        characteristics: value.characteristics,
      });
    });
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
      compareAtPrice: raw.compareAtPrice,
      personalizable: raw.personalizable,
      characteristics: raw.characteristics,
    };
    this.submitted.emit(value);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.cancelled.emit();
  }
}
