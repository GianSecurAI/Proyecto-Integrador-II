import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { CheckoutStateService } from '../state/checkout-state.service';
import { checkoutConfirmationGuard } from './checkout-confirmation.guard';

describe('checkoutConfirmationGuard', () => {
  let checkoutState: CheckoutStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    checkoutState = TestBed.inject(CheckoutStateService);
    router = TestBed.inject(Router);
  });

  it('redirects to /cart when there is no just-placed order', () => {
    const result = TestBed.runInInjectionContext(() => checkoutConfirmationGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/cart');
  });

  it('allows navigation once an order has been placed', () => {
    checkoutState.setPlacedOrder({ id: 'PED-MOCK-1', status: 'pendiente' });
    const result = TestBed.runInInjectionContext(() => checkoutConfirmationGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('is registered as the guard for /checkout/confirmacion — not directly reachable as a dead-end', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout/confirmacion');
    expect(router.url).toBe('/cart');
  });
});
