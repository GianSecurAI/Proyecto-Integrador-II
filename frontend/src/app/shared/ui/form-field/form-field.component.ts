import { Component, computed, input } from '@angular/core';

let nextFieldId = 0;

/**
 * Structural label/hint/error wrapper for a projected native form control. Deliberately has no
 * ControlValueAccessor and makes no assumption about the control type (text input, select,
 * textarea...) because the business forms it will support (custom order intake, contact
 * handoff, etc.) are not specified yet (Constitution Principle I). It only owns the accessible
 * label/error wiring every form field needs (Principle XVI); validation rules stay server-side
 * (Principle VIII) and are never invented here.
 *
 * Usage — the consumer wires the ids/attributes explicitly via the exported ref:
 * ```html
 * <app-form-field #field="appFormField" label="Correo electrónico" [error]="emailError()">
 *   <input class="ui-input" [id]="field.inputId()" [attr.aria-describedby]="field.describedBy()" />
 * </app-form-field>
 * ```
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  exportAs: 'appFormField',
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  private readonly generatedId = `ar-field-${++nextFieldId}`;

  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false);
  /** Pass only when the projected control already needs a specific id; otherwise auto-generated. */
  readonly providedId = input<string | null>(null);

  readonly inputId = computed(() => this.providedId() ?? this.generatedId);
  readonly hintElementId = computed(() => `${this.inputId()}-hint`);
  readonly errorElementId = computed(() => `${this.inputId()}-error`);
  readonly hasError = computed(() => !!this.error());

  readonly describedBy = computed(() => {
    if (this.error()) return this.errorElementId();
    if (this.hint()) return this.hintElementId();
    return null;
  });
}
