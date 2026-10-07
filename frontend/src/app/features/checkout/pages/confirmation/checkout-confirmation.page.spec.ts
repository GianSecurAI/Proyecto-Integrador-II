import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrderDetailViewModel } from '../../../account/models/order.model';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CheckoutConfirmationPage } from './checkout-confirmation.page';

describe('CheckoutConfirmationPage', () => {
  let fixture: ComponentFixture<CheckoutConfirmationPage>;
  let checkoutState: CheckoutStateService;

  const PLACED_AT = new Date('2026-09-07T15:30:00Z');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckoutConfirmationPage],
      providers: [provideRouter([])],
    });
    checkoutState = TestBed.inject(CheckoutStateService);
  });

  function placeOrder(): void {
    const order: OrderDetailViewModel = {
      id: 'PED-MOCK-1',
      status: 'CONFIRMADO',
      kind: 'ESTANDAR',
      placedAt: PLACED_AT,
      summary: '2 unidades: Llavero A',
      totalAmount: 39.8,
      items: [{ productId: 1, title: 'Llavero A', unitPrice: 19.9, quantity: 2, lineTotal: 39.8 }],
      delivery: { address: 'Calle 1', district: 'Lima', notes: null },
      statusHistory: [],
    };
    checkoutState.setPlacedOrder(order);
  }

  it('shows the order id and a "Confirmado" status badge, with no payment-processed claim', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-MOCK-1');
    expect(text).toContain('Confirmado');
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

  it('shows the server-computed items and total from the order response, plus delivery', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('S/ 39.80');
    expect(text).toContain('Calle 1, Lima');
  });

  it('links to the customer own order detail page', () => {
    placeOrder();
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href*="/account/orders/"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/account/orders/PED-MOCK-1');
  });
});
