import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacyPolicyPage } from './privacy-policy.page';

describe('PrivacyPolicyPage', () => {
  let fixture: ComponentFixture<PrivacyPolicyPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PrivacyPolicyPage] });
    fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();
  });

  it('renders exactly one h1 with the page title', () => {
    const h1s: HTMLHeadingElement[] = Array.from(fixture.nativeElement.querySelectorAll('h1'));
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toContain('Política de privacidad');
  });

  it('renders the OTP-only authentication section and never mentions a password', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Autenticación sin contraseña');
    expect(text.toLowerCase()).not.toContain('contraseña de tu cuenta');
    expect(text.toLowerCase()).not.toMatch(/almacenamos tu contraseña|guardamos tu contraseña/);
  });

  it('does not name a specific payment gateway provider', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toMatch(/stripe|phonepe|paypal|mercado ?pago|culqi/i);
  });

  it('renders every section as an h2 via the shared policy-section-list component', () => {
    const component = fixture.componentInstance;
    const headings: HTMLHeadingElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('h2'),
    );
    expect(headings.length).toBe(component.sections.length);
  });
});
