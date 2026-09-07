import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSummaryCardComponent } from './admin-summary-card.component';

@Component({
  standalone: true,
  imports: [AdminSummaryCardComponent],
  template: `
    <app-admin-summary-card
      label="Total de pedidos"
      [value]="42"
      caption="En el rango seleccionado"
      tone="info"
    />
  `,
})
class HostComponent {}

@Component({
  standalone: true,
  imports: [AdminSummaryCardComponent],
  template: `<app-admin-summary-card label="Incidencias" [value]="0" />`,
})
class NoCaptionHostComponent {}

describe('AdminSummaryCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the label', () => {
    const label: HTMLElement = fixture.nativeElement.querySelector('.admin-summary-card__label');
    expect(label.textContent).toContain('Total de pedidos');
  });

  it('renders the numeric value', () => {
    const value: HTMLElement = fixture.nativeElement.querySelector('.admin-summary-card__value');
    expect(value.textContent).toContain('42');
  });

  it('renders the optional caption', () => {
    const caption: HTMLElement = fixture.nativeElement.querySelector(
      '.admin-summary-card__caption',
    );
    expect(caption.textContent).toContain('En el rango seleccionado');
  });

  it('applies the tone as a CSS modifier class', () => {
    const card: HTMLElement = fixture.nativeElement.querySelector('.admin-summary-card');
    expect(card.classList).toContain('admin-summary-card--info');
  });
});

describe('AdminSummaryCardComponent (no caption)', () => {
  let fixture: ComponentFixture<NoCaptionHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NoCaptionHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(NoCaptionHostComponent);
    fixture.detectChanges();
  });

  it('omits the caption element when none is supplied', () => {
    expect(fixture.nativeElement.querySelector('.admin-summary-card__caption')).toBeNull();
  });
});
