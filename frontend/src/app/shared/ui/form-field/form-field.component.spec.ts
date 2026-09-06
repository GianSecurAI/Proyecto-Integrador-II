import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormFieldComponent } from './form-field.component';

@Component({
  standalone: true,
  imports: [FormFieldComponent],
  template: `
    <app-form-field #field="appFormField" label="Correo electrónico" [error]="error">
      <input
        class="ui-input"
        [id]="field.inputId()"
        [attr.aria-describedby]="field.describedBy()"
      />
    </app-form-field>
  `,
})
class HostComponent {
  error: string | null = null;
}

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('associates the label with the projected control via a shared, auto-generated id', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('renders the error message with role=alert and wires aria-describedby to it', () => {
    fixture.componentInstance.error = 'Correo inválido.';
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const error: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(error.textContent).toContain('Correo inválido.');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });
});
