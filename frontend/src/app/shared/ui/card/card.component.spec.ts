import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `<app-card padding="lg"><p>Contenido</p></app-card>`,
})
class HostComponent {}

@Component({
  standalone: true,
  imports: [CardComponent],
  // Simulates nesting a card inside a dark-themed ancestor that sets `color: white` on itself
  // for its own text (e.g. the Home page's product-showcase section).
  template: `<div style="color: rgb(255, 255, 255)">
    <app-card><p class="probe">Texto</p></app-card>
  </div>`,
})
class DarkAncestorHostComponent {}

describe('CardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('projects arbitrary content into the card body', () => {
    expect(fixture.nativeElement.textContent).toContain('Contenido');
  });

  it('applies the requested padding modifier class', () => {
    expect(fixture.nativeElement.querySelector('.app-card--padding-lg')).toBeTruthy();
  });
});

describe('CardComponent on a dark-themed ancestor', () => {
  it('resets projected text to the on-light color instead of inheriting white-on-white', async () => {
    await TestBed.configureTestingModule({
      imports: [DarkAncestorHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(DarkAncestorHostComponent);
    fixture.detectChanges();

    const probe: HTMLElement = fixture.nativeElement.querySelector('.probe');
    const color = getComputedStyle(probe).color;
    expect(color).not.toBe('rgb(255, 255, 255)');
  });
});
