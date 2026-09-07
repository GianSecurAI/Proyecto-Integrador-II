import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CheckoutConfirmationPage } from './checkout-confirmation.page';

describe('CheckoutConfirmationPage', () => {
  let fixture: ComponentFixture<CheckoutConfirmationPage>;
  let checkoutState: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckoutConfirmationPage],
      providers: [provideRouter([])],
    });
    checkoutState = TestBed.inject(CheckoutStateService);
  });

  it('shows the order id and a "Pendiente" status badge, with no payment-processed claim', () => {
    checkoutState.setPlacedOrder({ id: 'PED-MOCK-1', status: 'pendiente' });
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-MOCK-1');
    expect(text).toContain('Pendiente');
    expect(text.toLowerCase()).not.toContain('pago procesado');
    expect(text.toLowerCase()).not.toContain('pago confirmado');
  });

  it('links to /track-order carrying the order id as a non-sensitive query param', () => {
    checkoutState.setPlacedOrder({ id: 'PED-MOCK-1', status: 'pendiente' });
    fixture = TestBed.createComponent(CheckoutConfirmationPage);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href*="track-order"]',
    );
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('orderId=PED-MOCK-1');
  });
});
