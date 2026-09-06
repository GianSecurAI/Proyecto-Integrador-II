import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { FinalCtaComponent } from './final-cta.component';

describe('FinalCtaComponent', () => {
  let fixture: ComponentFixture<FinalCtaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalCtaComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FinalCtaComponent);
    fixture.detectChanges();
  });

  it('does not mention the Figma template brand', () => {
    expect(fixture.nativeElement.textContent).not.toContain('NUHO');
  });

  it('routes the primary CTA to the real catalog page', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const shopLink = links.find((link) => link.textContent?.includes('Comience a comprar'));
    expect(shopLink?.getAttribute('href')).toBe('/catalog');
  });

  it('links to WhatsApp using the environment placeholder number, not a hardcoded one', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const waLink = links.find((link) => link.textContent?.includes('Conecta por WhatsApp'));
    expect(waLink?.href).toContain(`https://wa.me/${environment.whatsappNumber}`);
  });
});
