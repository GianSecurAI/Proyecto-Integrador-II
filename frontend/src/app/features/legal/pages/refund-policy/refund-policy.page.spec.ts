import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RefundPolicyPage } from './refund-policy.page';

describe('RefundPolicyPage', () => {
  let fixture: ComponentFixture<RefundPolicyPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RefundPolicyPage] });
    fixture = TestBed.createComponent(RefundPolicyPage);
    fixture.detectChanges();
  });

  it('renders exactly one h1 with the page title', () => {
    const h1s: HTMLHeadingElement[] = Array.from(fixture.nativeElement.querySelectorAll('h1'));
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toContain('Política de reembolso');
  });

  it('distinguishes catalog refunds from advisor-mediated personalized order refunds', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('WhatsApp');
    expect(text).toContain('incidencia');
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
