import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShippingPolicyPage } from './shipping-policy.page';

describe('ShippingPolicyPage', () => {
  let fixture: ComponentFixture<ShippingPolicyPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ShippingPolicyPage] });
    fixture = TestBed.createComponent(ShippingPolicyPage);
    fixture.detectChanges();
  });

  it('renders exactly one h1 with the page title', () => {
    const h1s: HTMLHeadingElement[] = Array.from(fixture.nativeElement.querySelectorAll('h1'));
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toContain('Política de envío');
  });

  it('mentions the real public order-tracking flow', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('seguimiento de pedidos');
  });

  it('describes personalized orders as coordinated separately via WhatsApp', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('WhatsApp');
  });

  it('renders every section as an h2 via the shared policy-section-list component', () => {
    const component = fixture.componentInstance;
    const headings: HTMLHeadingElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('h2'),
    );
    expect(headings.length).toBe(component.sections.length);
  });
});
