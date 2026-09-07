import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CheckoutConfirmationPage } from './checkout-confirmation.page';

describe('CheckoutConfirmationPage', () => {
  let fixture: ComponentFixture<CheckoutConfirmationPage>;
  let checkoutState: CheckoutStateService;
  let session: SessionStateService;

  const PLACED_AT = new Date('2026-09-07T15:30:00Z');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckoutConfirmationPage],
      providers: [provideRouter([])],
    });
    checkoutState = TestBed.inject(CheckoutStateService);
    session = TestBed.inject(SessionStateService);
  });

  function placeOrder(): void {
    checkoutState.setPlacedOrder({
      id: 'PED-MOCK-1',
      status: 'pendiente',
      placedAt: PLACED_AT,
      summary: '2 unidades: Llavero A',
    });
  }

  it('shows the order id and a "Pendiente" status badge, with no payment-processed claim', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-MOCK-1');
    expect(text).toContain('Pendiente');
    expect(text.toLowerCase()).not.toContain('pago procesado');
    expect(text.toLowerCase()).not.toContain('pago confirmado');
  });

  it('links to /track-order carrying the order id as a non-sensitive query param', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href*="track-order"]',
    );
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('orderId=PED-MOCK-1');
  });

  it('wraps the confirmation content in the app-card shell', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-card')).toBeTruthy();
  });

  it('renders the order summary and placed-at date', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('2 unidades: Llavero A');
    // Same es-PE Intl.DateTimeFormat convention as order-detail.page.ts — assert on the year
    // rather than a locale-specific full string to avoid over-coupling this test to formatting.
    expect(text).toContain('2026');
  });

  it('shows a "Ver mi pedido" link to the customer-scoped order detail page for an authenticated CLIENTE session', () => {
    placeOrder();
    session.markAuthenticated('CLIENTE');
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href*="/account/orders/"]',
    );
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/account/orders/PED-MOCK-1');
  });

  it('omits the "Ver mi pedido" link for a guest/unauthenticated session', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href*="/account/orders/"]')).toBeFalsy();
  });

  it('omits the "Ver mi pedido" link for a staff (non-CLIENTE) session', () => {
    placeOrder();
    session.markAuthenticated('ADMINISTRADOR');
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href*="/account/orders/"]')).toBeFalsy();
  });
});
