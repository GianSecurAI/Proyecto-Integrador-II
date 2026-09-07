import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(StatusBadgeComponent);
  });

  it('renders the given label', () => {
    fixture.componentRef.setInput('label', 'Entregado');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Entregado');
  });

  it('defaults to the neutral tone when none is given', () => {
    fixture.componentRef.setInput('label', 'Pendiente');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('ui-status-badge--neutral');
  });

  it('applies the requested tone class', () => {
    fixture.componentRef.setInput('label', 'Cancelado');
    fixture.componentRef.setInput('tone', 'danger');
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.className).toContain('ui-status-badge--danger');
  });
});
