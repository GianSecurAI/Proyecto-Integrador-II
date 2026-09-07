import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminRegisterPersonalizedOrderPage } from './admin-register-personalized-order.page';
import { AdminOrdersMockService } from '../../services/admin-orders-mock.service';
import { AdminOrderViewModel } from '../../models/admin-order.model';

/**
 * Covers CLAUDE.md's "Business clarification: purchasing flows" §"Custom / personalized
 * products" grounding: no submission without the payment attestation, no auto-calculation of the
 * amount, and a successful registration navigates to the new order's detail page.
 */
describe('AdminRegisterPersonalizedOrderPage', () => {
  let fixture: ComponentFixture<AdminRegisterPersonalizedOrderPage>;
  let component: AdminRegisterPersonalizedOrderPage;
  let service: Partial<AdminOrdersMockService> & { registerPersonalizedOrder: jasmine.Spy };
  let router: Router;

  beforeEach(async () => {
    service = { registerPersonalizedOrder: jasmine.createSpy('registerPersonalizedOrder') };

    await TestBed.configureTestingModule({
      imports: [AdminRegisterPersonalizedOrderPage],
      providers: [
        provideRouter([]),
        { provide: AdminOrdersMockService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRegisterPersonalizedOrderPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function fillValidFormExcept(overrides: Partial<Record<string, unknown>>): void {
    component.form.setValue({
      customerEmail: 'cliente@example.com',
      quotationDescription: 'Pieza acordada por WhatsApp',
      quotationAmount: 99.9,
      paymentConfirmed: true,
      ...overrides,
    });
  }

  it('does not submit when the payment-confirmation checkbox is unchecked', () => {
    fillValidFormExcept({ paymentConfirmed: false });

    component.submit();

    expect(service.registerPersonalizedOrder).not.toHaveBeenCalled();
    expect(component.paymentConfirmedControl.invalid).toBe(true);
    expect(component.paymentConfirmedControl.touched).toBe(true);
  });

  it('does not submit with an invalid email', () => {
    fillValidFormExcept({ customerEmail: 'not-an-email' });

    component.submit();

    expect(service.registerPersonalizedOrder).not.toHaveBeenCalled();
    expect(component.customerEmailControl.invalid).toBe(true);
  });

  it('does not submit with a non-positive amount', () => {
    fillValidFormExcept({ quotationAmount: 0 });

    component.submit();

    expect(service.registerPersonalizedOrder).not.toHaveBeenCalled();
    expect(component.quotationAmountControl.invalid).toBe(true);
  });

  it('never derives/calculates quotationAmount — it forwards exactly the typed value', () => {
    service.registerPersonalizedOrder.and.returnValue(
      of({ id: 'PED-NEW-1' } as unknown as AdminOrderViewModel),
    );
    fillValidFormExcept({ quotationAmount: 250.5 });

    component.submit();

    expect(service.registerPersonalizedOrder).toHaveBeenCalledOnceWith({
      customerEmail: 'cliente@example.com',
      quotationDescription: 'Pieza acordada por WhatsApp',
      quotationAmount: 250.5,
      paymentConfirmed: true,
    });
  });

  it('navigates to the new order detail page on a successful registration', () => {
    service.registerPersonalizedOrder.and.returnValue(
      of({ id: 'PED-NEW-42' } as unknown as AdminOrderViewModel),
    );
    const navigateSpy = spyOn(router, 'navigate');
    fillValidFormExcept({});

    component.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/admin/orders', 'PED-NEW-42']);
  });

  it('shows an inline error and does not navigate when the mock registration fails', () => {
    service.registerPersonalizedOrder.and.returnValue(throwError(() => new Error('boom')));
    const navigateSpy = spyOn(router, 'navigate');
    fillValidFormExcept({});

    component.submit();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBeTruthy();
  });
});
