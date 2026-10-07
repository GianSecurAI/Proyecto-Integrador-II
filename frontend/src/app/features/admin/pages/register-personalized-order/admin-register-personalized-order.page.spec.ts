import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminOrderViewModel } from '../../models/admin-order.model';
import { AdminOrdersService } from '../../services/admin-orders.service';
import { AdminRegisterPersonalizedOrderPage } from './admin-register-personalized-order.page';

/**
 * Covers CLAUDE.md's "Business clarification: purchasing flows" §"Custom / personalized
 * products": no submission without the payment attestation, no auto-calculation of the amount,
 * Idempotency-Key per attempt, backend errors surfaced, and navigation to the new order.
 */
describe('AdminRegisterPersonalizedOrderPage (POST /api/admin/orders/personalized)', () => {
  let fixture: ComponentFixture<AdminRegisterPersonalizedOrderPage>;
  let component: AdminRegisterPersonalizedOrderPage;
  let service: { registerPersonalized: jasmine.Spy };
  let router: Router;

  beforeEach(async () => {
    service = { registerPersonalized: jasmine.createSpy('registerPersonalized') };

    await TestBed.configureTestingModule({
      imports: [AdminRegisterPersonalizedOrderPage],
      providers: [provideRouter([]), { provide: AdminOrdersService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRegisterPersonalizedOrderPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function fillValidFormExcept(overrides: Partial<Record<string, unknown>>): void {
    component.form.setValue({
      customerEmail: 'cliente@example.com',
      description: 'Pieza acordada por WhatsApp',
      agreedAmount: 99.9,
      paymentConfirmed: true,
      ...overrides,
    });
  }

  function created(id: string) {
    return of({ order: { id } as AdminOrderViewModel, replayed: false });
  }

  it('does not submit when the payment-confirmation checkbox is unchecked', () => {
    fillValidFormExcept({ paymentConfirmed: false });
    component.submit();
    expect(service.registerPersonalized).not.toHaveBeenCalled();
    expect(component.paymentConfirmedControl.invalid).toBe(true);
    expect(component.paymentConfirmedControl.touched).toBe(true);
  });

  it('does not submit with an invalid email', () => {
    fillValidFormExcept({ customerEmail: 'not-an-email' });
    component.submit();
    expect(service.registerPersonalized).not.toHaveBeenCalled();
    expect(component.customerEmailControl.invalid).toBe(true);
  });

  it('does not submit with a non-positive amount or one above the backend maximum', () => {
    fillValidFormExcept({ agreedAmount: 0 });
    component.submit();
    fillValidFormExcept({ agreedAmount: 1_000_000 });
    component.submit();
    expect(service.registerPersonalized).not.toHaveBeenCalled();
    expect(component.agreedAmountControl.invalid).toBe(true);
  });

  it('never derives the amount: it forwards exactly the typed value, with an Idempotency-Key', () => {
    service.registerPersonalized.and.returnValue(created('PED-NEW-1'));
    fillValidFormExcept({ agreedAmount: 250.5 });
    component.submit();
    expect(service.registerPersonalized).toHaveBeenCalledTimes(1);
    const [value, key] = service.registerPersonalized.calls.mostRecent().args;
    expect(value).toEqual({
      customerEmail: 'cliente@example.com',
      description: 'Pieza acordada por WhatsApp',
      agreedAmount: 250.5,
      paymentConfirmed: true,
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses the same Idempotency-Key when the same submission is retried after a failure', () => {
    service.registerPersonalized.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL_ERROR' } })),
      created('PED-NEW-2'),
    );
    spyOn(router, 'navigate');
    fillValidFormExcept({});
    component.submit();
    component.submit();
    const keys = service.registerPersonalized.calls.allArgs().map((args) => args[1]);
    expect(keys[0]).toBe(keys[1]);
  });

  it('navigates to the new order detail page on success', () => {
    service.registerPersonalized.and.returnValue(created('PED-NEW-42'));
    const navigateSpy = spyOn(router, 'navigate');
    fillValidFormExcept({});
    component.submit();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/orders', 'PED-NEW-42']);
  });

  it('shows 400 VALIDATION_FAILED field errors on the matching control', () => {
    service.registerPersonalized.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'x',
              timestamp: 't',
              fieldErrors: [{ field: 'description', message: 'must not contain card or account numbers' }],
            },
          }),
      ),
    );
    spyOn(router, 'navigate');
    fillValidFormExcept({});
    component.submit();
    fixture.detectChanges();
    expect(component.descriptionControl.errors?.['server']).toBe(
      'must not contain card or account numbers',
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('explains 409 CUSTOMER_NOT_ELIGIBLE (staff or deactivated account)', () => {
    service.registerPersonalized.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CUSTOMER_NOT_ELIGIBLE', message: 'x', timestamp: 't' },
          }),
      ),
    );
    fillValidFormExcept({});
    component.submit();
    expect(component.errorMessage()).toContain('cuenta de personal o desactivada');
  });

  it('shows a generic inline error and does not navigate when registration fails', () => {
    service.registerPersonalized.and.returnValue(throwError(() => new Error('boom')));
    const navigateSpy = spyOn(router, 'navigate');
    fillValidFormExcept({});
    component.submit();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBeTruthy();
  });
});
