import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { ProfileFieldRowComponent } from '../../components/profile-field-row/profile-field-row.component';
import { EditableCustomerProfileFields } from '../../models/customer-profile.model';
import { CustomerProfileService } from '../../services/customer-profile.service';
import { applyFieldErrors } from '../../../../core/errors/form-errors';

/**
 * Local, page-only form model — the editable subset of `CustomerProfileViewModel`
 * (../../models/customer-profile.model.ts). Kept as its own type (rather than reusing the
 * ViewModel directly) so the form never accidentally grows an `email`/`memberSince` control.
 */
type ProfileFormValue = EditableCustomerProfileFields;

/**
 * RF-04 ("Gestión de perfil de cliente"): the signed-in customer's profile, backed by
 * `GET`/`PUT /api/customers/me`. Email and member-since are read-only (the email is the login
 * identity); first name, last name and phone are editable. Client validation (phone shape) mirrors
 * the backend DTO for UX only; a `400 VALIDATION_FAILED` from the server is shown on the matching
 * field. No password field exists anywhere (Principle VI).
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    FormFieldComponent,
    AccountNavComponent,
    ProfileFieldRowComponent,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly profileService = inject(CustomerProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = this.profileService.profile;
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly editing = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly memberSinceLabel = computed(() =>
    new Intl.DateTimeFormat('es-PE', { year: 'numeric', month: 'long' }).format(
      this.profile().memberSince,
    ),
  );

  readonly form = new FormGroup<{ [K in keyof ProfileFormValue]: FormControl<string> }>({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    // UX format check only — production validation belongs to a future real integration, same
    // loose shape already used by register.page.ts's optional phone field.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[0-9+\-\s()]{6,20}$/)],
    }),
  });

  get firstNameControl() {
    return this.form.controls.firstName;
  }
  get lastNameControl() {
    return this.form.controls.lastName;
  }
  get phoneControl() {
    return this.form.controls.phone;
  }

  constructor() {
    this.profileService
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  startEditing(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    const current = this.profile();
    this.form.setValue({
      firstName: current.firstName,
      lastName: current.lastName,
      phone: current.phone,
    });
    this.editing.set(true);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.form.reset();
    this.errorMessage.set(null);
    this.editing.set(false);
  }

  save(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const changes: EditableCustomerProfileFields = this.form.getRawValue();
    this.profileService
      .save(changes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.editing.set(false);
          this.form.reset();
          this.successMessage.set('Tus datos se actualizaron correctamente.');
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          // A 400 VALIDATION_FAILED is attached to the matching control (backend field names are
          // the form control names); anything else is a generic message.
          const unmatched = applyFieldErrors(this.form, err);
          this.errorMessage.set(
            unmatched.length > 0 || this.form.invalid
              ? 'Revisa los datos ingresados e inténtalo de nuevo.'
              : 'No pudimos guardar los cambios. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }
}
