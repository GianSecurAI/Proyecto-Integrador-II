import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WhyChooseUsComponent } from './why-choose-us.component';

describe('WhyChooseUsComponent', () => {
  let fixture: ComponentFixture<WhyChooseUsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WhyChooseUsComponent] }).compileComponents();
    fixture = TestBed.createComponent(WhyChooseUsComponent);
    fixture.detectChanges();
  });

  it('renders the Ar Makers 3D brand, not the Figma template brand', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Ar Makers 3D');
    expect(text).not.toContain('NUHO');
  });

  it('renders four feature cards', () => {
    expect(fixture.nativeElement.querySelectorAll('.feature-card').length).toBe(4);
  });

  it('replaces the unconfirmed shipping-policy card with the real WhatsApp advisory flow', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Asesoría personalizada');
    expect(text).toContain('WhatsApp');
    expect(text).not.toContain('Envío gratis');
  });

  it('marks every icon as decorative', () => {
    const icons = fixture.nativeElement.querySelectorAll('svg');
    expect(icons.length).toBe(4);
    icons.forEach((icon: SVGElement) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
