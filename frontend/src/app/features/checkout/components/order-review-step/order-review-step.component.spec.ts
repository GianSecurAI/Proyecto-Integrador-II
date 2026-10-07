import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CheckoutDto, CreateCheckoutRequest } from '../../models/checkout.model';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CheckoutService } from '../../services/checkout.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { OrderReviewStepComponent } from './order-review-step.component';

const PRODUCT: CatalogProduct = {
  id: 1,
  category: 'LLAVERO',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

const CUSTOMER_INFO = { fullName: 'Ana Torres', phone: '987654321' };
const DELIVERY_INFO = { address: 'Av. Los Álamos 123', district: 'Miraflores', notes: '' };

class FakeCartStorageAdapter implements CartStorageAdapter {
  private saved: readonly CartItem[] = [];
  load(): readonly CartItem[] {
    return this.saved;
  }
  save(items: readonly CartItem[]): void {
    this.saved = items;
  }
  clear(): void {
    this.saved = [];
  }
}

const CREATED: CheckoutDto = {
  checkoutId: '3f2b8c1e-0000-4000-8000-000000000001',
  status: 'AWAITING_PAYMENT_PROOF',
  orderId: null,
  totalAmount: 19.9,
  currency: 'PEN',
  createdAt: '2026-10-07T17:00:00Z',
  expiresAt: '2026-10-08T17:00:00Z',
  items: [{ productId: 1, title: 'Llavero A', unitPrice: 19.9, quantity: 1, lineTotal: 19.9 }],
  paymentInstructions: { methods: ['YAPE', 'PLIN'], amount: 19.9, currency: 'PEN', reference: 'AM3D-3F2B8C1E' },
  proofStatus: 'NONE',
  rejectionReason: null,
  attemptsRemaining: 5,
  attempts: [],
};

function apiError(status: number, code: string, fieldErrors?: { field: string; message: string }[]) {
  return new HttpErrorResponse({
    status,
    error: { code, message: 'x', timestamp: 't', ...(fieldErrors ? { fieldErrors } : {}) },
  });
}

describe('OrderReviewStepComponent (POST /api/checkout)', () => {
  let fixture: ComponentFixture<OrderReviewStepComponent>;
  let component: OrderReviewStepComponent;
  let cart: CartStateService;
  let checkoutState: CheckoutStateService;
  let router: Router;

  function setup(create: (request: CreateCheckoutRequest, key: string) => Observable<CheckoutDto>) {
    TestBed.configureTestingModule({
      imports: [OrderReviewStepComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
        { provide: CheckoutService, useValue: { create } },
      ],
    });
    TestBed.inject(SessionStateService).markAuthenticated('CLIENTE', 'ana@example.com', 3);
    cart = TestBed.inject(CartStateService);
    checkoutState = TestBed.inject(CheckoutStateService);
    router = TestBed.inject(Router);
    cart.addItem(PRODUCT, 1);
    checkoutState.setCustomerInfo(CUSTOMER_INFO);
    checkoutState.setDeliveryInfo(DELIVERY_INFO);
    fixture = TestBed.createComponent(OrderReviewStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('reflects cart contents, the account email and the typed info, with no payment-done claim', () => {
    setup(() => of(CREATED));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('Ana Torres');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Av. Los Álamos 123');
    expect(text.toLowerCase()).not.toContain('pago procesado');
    expect(text).toContain('Total estimado');
  });

  it('sends only productId/quantity + delivery + contact with an Idempotency-Key, KEEPS the cart and goes to the payment page', fakeAsync(() => {
    const spy = jasmine.createSpy('create').and.returnValue(of(CREATED));
    setup(spy);
    const navigateSpy = spyOn(router, 'navigate');

    component.submit();
    tick();

    expect(spy).toHaveBeenCalledTimes(1);
    const [request, key] = spy.calls.mostRecent().args as [CreateCheckoutRequest, string];
    expect(request).toEqual({
      items: [{ productId: 1, quantity: 1 }],
      delivery: { address: 'Av. Los Álamos 123', district: 'Miraflores' },
      contact: { fullName: 'Ana Torres', phone: '987654321' },
    });
    expect(JSON.stringify(request)).not.toContain('19.9');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    // The cart is cleared only when the checkout is PAID (status page), never at creation.
    expect(cart.isEmpty()).toBe(false);
    expect(checkoutState.pendingCheckoutId()).toBe(CREATED.checkoutId);
    expect(checkoutState.customerInfo()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/checkout/confirmacion'], {
      queryParams: { checkoutId: CREATED.checkoutId },
    });
  }));

  it('keeps the cart until the backend confirms: nothing is cleared while the request is in flight', () => {
    const pending = new Subject<CheckoutDto>();
    setup(() => pending);
    spyOn(router, 'navigate');
    component.submit();
    expect(component.submitting()).toBeTrue();
    expect(cart.isEmpty()).toBe(false);
    expect(checkoutState.pendingCheckoutId()).toBeNull();
  });

  it('on a generic failure shows an error, keeps the cart and reuses the SAME key on retry', fakeAsync(() => {
    const keys: string[] = [];
    let call = 0;
    setup((_request, key) => {
      keys.push(key);
      call++;
      return call === 1 ? throwError(() => apiError(500, 'INTERNAL_ERROR')) : of(CREATED);
    });
    spyOn(router, 'navigate');

    component.submit();
    tick();
    expect(component.errorMessage()).toBeTruthy();
    expect(cart.isEmpty()).toBe(false);
    expect(component.submitting()).toBe(false);

    component.submit();
    tick();
    expect(keys.length).toBe(2);
    expect(keys[1]).toBe(keys[0]);
  }));

  it('shows labelled field messages for 400 VALIDATION_FAILED', fakeAsync(() => {
    setup(() =>
      throwError(() =>
        apiError(400, 'VALIDATION_FAILED', [
          { field: 'delivery.address', message: 'must be at most 200 characters' },
          { field: 'items[0].quantity', message: 'must be between 1 and 99' },
        ]),
      ),
    );
    component.submit();
    tick();
    fixture.detectChanges();
    expect(component.fieldMessages()).toEqual([
      'Dirección: must be at most 200 characters',
      'Cantidad: must be between 1 and 99',
    ]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Dirección');
    expect(cart.isEmpty()).toBe(false);
  }));

  it('409 PRODUCT_UNAVAILABLE explains it and keeps the cart', fakeAsync(() => {
    setup(() => throwError(() => apiError(409, 'PRODUCT_UNAVAILABLE')));
    spyOn(cart, 'revalidate').and.returnValue(of(undefined));
    component.submit();
    tick();
    expect(component.errorMessage()).toContain('ya no están disponibles');
    expect(cart.revalidate).toHaveBeenCalled();
    expect(cart.isEmpty()).toBe(false);
  }));

  it('409 IDEMPOTENCY_KEY_REUSED resets the attempt so the next try uses a new key', fakeAsync(() => {
    const keys: string[] = [];
    let call = 0;
    setup((_request, key) => {
      keys.push(key);
      call++;
      return call === 1 ? throwError(() => apiError(409, 'IDEMPOTENCY_KEY_REUSED')) : of(CREATED);
    });
    spyOn(router, 'navigate');
    component.submit();
    tick();
    component.submit();
    tick();
    expect(keys[1]).not.toBe(keys[0]);
  }));

  it('409 CONFLICT (too many open checkouts) tells the customer to finish or cancel one', fakeAsync(() => {
    setup(() => throwError(() => apiError(409, 'CONFLICT')));
    component.submit();
    tick();
    expect(component.errorMessage()).toContain('pagos pendientes');
    expect(cart.isEmpty()).toBe(false);
  }));

  it('429 asks the customer to wait', fakeAsync(() => {
    setup(() => throwError(() => apiError(429, 'RATE_LIMITED')));
    component.submit();
    tick();
    expect(component.errorMessage()).toContain('Demasiados intentos');
  }));

  it('double-clicking submit results in only one call while a request is in flight', fakeAsync(() => {
    const spy = jasmine.createSpy('create').and.returnValue(of(CREATED));
    setup(spy);
    spyOn(router, 'navigate');
    component.submit();
    component.submit();
    tick();
    expect(spy).toHaveBeenCalledTimes(1);
  }));

  it('does not submit while the cart has lines the server no longer lists', () => {
    const spy = jasmine.createSpy('create').and.returnValue(of(CREATED));
    setup(spy);
    cart['unavailableState'].set(new Set([1])); // as flagged by a previous revalidate()
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });
});
