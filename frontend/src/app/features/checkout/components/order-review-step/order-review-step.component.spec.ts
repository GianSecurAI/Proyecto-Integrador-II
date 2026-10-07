import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { OrderDetailViewModel } from '../../../account/models/order.model';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { PlaceOrderRequest, StandardOrdersService } from '../../services/standard-orders.service';
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

const CREATED_ORDER: OrderDetailViewModel = {
  id: 'PED-20261006-0001',
  placedAt: new Date('2026-09-07T00:00:00Z'),
  status: 'PENDIENTE',
  kind: 'ESTANDAR',
  summary: '1 unidad: Llavero A',
  totalAmount: 19.9,
  items: [{ productId: 1, title: 'Llavero A', unitPrice: 19.9, quantity: 1, lineTotal: 19.9 }],
  delivery: { address: 'Av. Los Álamos 123', district: 'Miraflores', notes: null },
  statusHistory: [],
};

function apiError(status: number, code: string, fieldErrors?: { field: string; message: string }[]) {
  return new HttpErrorResponse({
    status,
    error: { code, message: 'x', timestamp: 't', ...(fieldErrors ? { fieldErrors } : {}) },
  });
}

describe('OrderReviewStepComponent (POST /api/orders)', () => {
  let fixture: ComponentFixture<OrderReviewStepComponent>;
  let component: OrderReviewStepComponent;
  let cart: CartStateService;
  let checkoutState: CheckoutStateService;
  let router: Router;

  function setup(place: (request: PlaceOrderRequest, key: string) => Observable<OrderDetailViewModel>) {
    TestBed.configureTestingModule({
      imports: [OrderReviewStepComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
        { provide: StandardOrdersService, useValue: { place } },
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

  it('reflects cart contents, the account email and the typed info, with no payment claim', () => {
    setup(() => of(CREATED_ORDER));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('Ana Torres');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Av. Los Álamos 123');
    expect(text.toLowerCase()).not.toContain('pago procesado');
    expect(text).toContain('Total estimado');
  });

  it('sends only productId/quantity + delivery + contact with an Idempotency-Key, then clears the cart and navigates', fakeAsync(() => {
    const spy = jasmine.createSpy('place').and.returnValue(of(CREATED_ORDER));
    setup(spy);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    component.submit();
    tick();

    expect(spy).toHaveBeenCalledTimes(1);
    const [request, key] = spy.calls.mostRecent().args as [PlaceOrderRequest, string];
    expect(request).toEqual({
      items: [{ productId: 1, quantity: 1 }],
      delivery: { address: 'Av. Los Álamos 123', district: 'Miraflores' },
      contact: { fullName: 'Ana Torres', phone: '987654321' },
    });
    expect(JSON.stringify(request)).not.toContain('19.9');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(cart.isEmpty()).toBe(true);
    expect(checkoutState.placedOrder()).toBe(CREATED_ORDER);
    expect(checkoutState.customerInfo()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/checkout/confirmacion');
  }));

  it('keeps the cart until the backend confirms: nothing is cleared while the request is in flight', () => {
    const pending = new Subject<OrderDetailViewModel>();
    setup(() => pending);
    spyOn(router, 'navigateByUrl');
    component.submit();
    expect(component.submitting()).toBeTrue();
    expect(cart.isEmpty()).toBe(false);
    expect(checkoutState.placedOrder()).toBeNull();
  });

  it('on a generic failure shows an error, keeps the cart and reuses the SAME key on retry', fakeAsync(() => {
    const keys: string[] = [];
    let call = 0;
    setup((_request, key) => {
      keys.push(key);
      call++;
      return call === 1 ? throwError(() => apiError(500, 'INTERNAL_ERROR')) : of(CREATED_ORDER);
    });
    spyOn(router, 'navigateByUrl');

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
      return call === 1 ? throwError(() => apiError(409, 'IDEMPOTENCY_KEY_REUSED')) : of(CREATED_ORDER);
    });
    spyOn(router, 'navigateByUrl');
    component.submit();
    tick();
    component.submit();
    tick();
    expect(keys[1]).not.toBe(keys[0]);
  }));

  it('429 asks the customer to wait', fakeAsync(() => {
    setup(() => throwError(() => apiError(429, 'RATE_LIMITED')));
    component.submit();
    tick();
    expect(component.errorMessage()).toContain('Demasiados intentos');
  }));

  it('double-clicking submit results in only one call while a request is in flight', fakeAsync(() => {
    const spy = jasmine.createSpy('place').and.returnValue(of(CREATED_ORDER));
    setup(spy);
    spyOn(router, 'navigateByUrl');
    component.submit();
    component.submit();
    tick();
    expect(spy).toHaveBeenCalledTimes(1);
  }));

  it('does not submit while the cart has lines the server no longer lists', () => {
    const spy = jasmine.createSpy('place').and.returnValue(of(CREATED_ORDER));
    setup(spy);
    cart['unavailableState'].set(new Set([1])); // as flagged by a previous revalidate()
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });
});
