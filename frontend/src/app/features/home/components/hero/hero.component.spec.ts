import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeroComponent } from './hero.component';

describe('HeroComponent', () => {
  let fixture: ComponentFixture<HeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HeroComponent);
    fixture.detectChanges();
  });

  it('renders a single real h1 heading, not multiple hardcoded lines', () => {
    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent).toContain('Productos');
    expect(headings[0].textContent).toContain('regalos personalizados');
  });

  it('routes the primary CTA to the real catalog page', () => {
    const cta: HTMLAnchorElement = fixture.nativeElement.querySelector('.hero__cta');
    expect(cta.getAttribute('href')).toBe('/catalog');
  });

  it('shows no hard-coded business statistics (counts, ratings)', () => {
    expect(fixture.nativeElement.querySelector('.hero__stats')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/\d+\+|★/);
  });
});
