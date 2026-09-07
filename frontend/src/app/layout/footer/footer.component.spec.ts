import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
  });

  it('shows the current year in the copyright line', () => {
    expect(fixture.nativeElement.textContent).toContain(String(new Date().getFullYear()));
  });

  it('does not render any payment-method or third-party review badges (05-figma-analysis §9 exclusions)', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toMatch(/UPI|VISA|MASTERCARD|RUPIA|Trustpilot/i);
  });

  /**
   * Figma's own footer groups links into two columns ("Enlaces rápidos"/"Políticas") — see
   * `footer.component.html`. This asserts both headings exist and each groups the right links,
   * pointing at the right route.
   */
  it('groups "Inicio"/"Iniciar sesión"/"Seguimiento del pedido" under an "Enlaces rápidos" heading', () => {
    const heading = fixture.nativeElement.querySelector('#footer-quick-links-heading');
    expect(heading?.textContent).toContain('Enlaces rápidos');

    const nav = fixture.nativeElement.querySelector(
      'nav[aria-labelledby="footer-quick-links-heading"]',
    ) as HTMLElement;
    const links: HTMLAnchorElement[] = Array.from(nav.querySelectorAll('a'));
    const byText = (text: string) => links.find((link) => link.textContent?.trim() === text);

    expect(byText('Inicio')?.getAttribute('href')).toBe('/');
    expect(byText('Iniciar sesión')?.getAttribute('href')).toBe('/auth/request-code');
    expect(byText('Seguimiento del pedido')?.getAttribute('href')).toBe('/track-order');
  });

  it('groups the 5 new legal/contact links under a "Políticas" heading, each routing to the right path', () => {
    const heading = fixture.nativeElement.querySelector('#footer-policies-heading');
    expect(heading?.textContent).toContain('Políticas');

    const nav = fixture.nativeElement.querySelector(
      'nav[aria-labelledby="footer-policies-heading"]',
    ) as HTMLElement;
    const links: HTMLAnchorElement[] = Array.from(nav.querySelectorAll('a'));
    expect(links.length).toBe(5);

    const byText = (text: string) => links.find((link) => link.textContent?.trim() === text);
    const expected: Array<[string, string]> = [
      ['Política de privacidad', '/legal/privacidad'],
      ['Política de reembolso', '/legal/reembolso'],
      ['Términos de servicio', '/legal/terminos'],
      ['Política de envío', '/legal/envio'],
      ['Información del contacto', '/legal/contacto'],
    ];
    for (const [text, path] of expected) {
      const link = byText(text);
      expect(link).withContext(`link with text "${text}"`).toBeTruthy();
      expect(link?.getAttribute('href')).toBe(path);
    }
  });
});
