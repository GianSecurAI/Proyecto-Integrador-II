import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

@Component({
  standalone: true,
  imports: [ButtonComponent],
  template: `<app-button (clicked)="onClick()" [disabled]="disabled" [loading]="loading">
    Enviar
  </app-button>`,
})
class HostComponent {
  disabled = false;
  loading = false;
  clickCount = 0;

  onClick(): void {
    this.clickCount++;
  }
}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('projects its content as the button label', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent?.trim()).toContain('Enviar');
  });

  it('emits clicked when pressed', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    expect(fixture.componentInstance.clickCount).toBe(1);
  });

  it('does not emit clicked when disabled', () => {
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    expect(fixture.componentInstance.clickCount).toBe(0);
  });

  it('does not emit clicked while loading, and marks itself busy for assistive tech', () => {
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(fixture.componentInstance.clickCount).toBe(0);
  });
});
