import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AccountNavComponent } from '../../components/account-nav/account-nav.component';
import { ProfileFieldRowComponent } from '../../components/profile-field-row/profile-field-row.component';
import { EditableCustomerProfileFields } from '../../models/customer-profile.model';
import { CustomerProfileMockService } from '../../services/customer-profile-mock.service';

/**
 * Local, page-only form model — the editable subset of `CustomerProfileViewModel`
 * (../../models/customer-profile.model.ts). Kept as its own type (rather than reusing the
 * ViewModel directly) so the form never accidentally grows an `email`/`memberSince` control.
 */
type ProfileFormValue = EditableCustomerProfileFields;

/**
 * RF-04 ("Gestión de perfil de cliente", docs/discovery/06-system-definition.md line 53).
 * `docs/discovery/01-requirements-analysis.md` line 308 confirms RF-04's need is approved but its
 * Gherkin/editable-fields are undefined by that spec, and no `spec.md` exists for it yet — the
 * field set implemented here (email read-only, member-since read-only, firstName/lastName/phone
 * editable) is grounded instead in the two sources documented in `../../mocks/customer-profile.mock.ts`
 * (the real `Cliente` backend entity, and the Product Owner amendment in
 * `specs/001-customer-otp-auth/spec.md`). No Figma frame exists for this screen — confirmed absent
 * from the project Figma file and documented as a `DESIGN_ONLY` gap in
 * `docs/discovery/05-figma-analysis.md` — so this screen instead reuses the existing light-theme
 * design system (`app-card`, `app-form-field`, `app-button`, `_tokens.scss`) per Constitution
 * Principle XV, following the same visual conventions as `product-detail.page.ts`/`home.page.ts`
 * rather than the dark auth-terminal system (`features/auth/auth-shared.css`).
 *
 * This is a frontend-only preview: `CustomerProfileMockService` is an isolated in-memory mock, no
 * REST contract for reading/updating a profile is defined, and no password field exists here or
 * anywhere in this feature (Constitution Principle VI, NON-NEGOTIABLE).
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
  private readonly profileService = inject(CustomerProfileMockService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = this.profileService.profile;
  readonly loading = signal(true);
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
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
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
      .subscribe(() => this.loading.set(false));
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
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('No pudimos guardar los cambios. Inténtalo de nuevo más tarde.');
        },
      });
  }
}
