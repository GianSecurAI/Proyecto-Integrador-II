import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TermsOfServicePage } from './terms-of-service.page';

describe('TermsOfServicePage', () => {
  let fixture: ComponentFixture<TermsOfServicePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TermsOfServicePage] });
    fixture = TestBed.createComponent(TermsOfServicePage);
    fixture.detectChanges();
  });

  it('renders exactly one h1 with the page title', () => {
    const h1s: HTMLHeadingElement[] = Array.from(fixture.nativeElement.querySelectorAll('h1'));
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toContain('Términos de servicio');
  });

  it('describes both purchasing flows distinctly, without blending them', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('carrito');
    expect(text).toContain('WhatsApp');
    expect(text).toContain('asesor');
  });

  it('describes OTP-only access and never asks the customer to create/store a password', () => {
    const text: string = fixture.nativeElement.textContent.toLowerCase();
    expect(text).toContain('código temporal');
    expect(text).not.toMatch(/crea(r)? una contraseña|tu contraseña|ingresa tu contraseña/);
  });

  it('uses generic Peru-appropriate jurisdiction language without citing a specific statute number', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('leyes aplicables en Perú');
    expect(text).not.toMatch(/ley n[°º]?\s*\d/i);
  });

  it('renders every section as an h2 via the shared policy-section-list component', () => {
    const component = fixture.componentInstance;
    const headings: HTMLHeadingElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('h2'),
    );
    expect(headings.length).toBe(component.sections.length);
  });
});
