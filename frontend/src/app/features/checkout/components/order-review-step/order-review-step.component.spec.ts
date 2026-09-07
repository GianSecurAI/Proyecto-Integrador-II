import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import {
  CustomerOrdersMockService,
  OrdersMockError,
} from '../../../account/services/customer-orders-mock.service';
import { OrderDetailViewModel } from '../../../account/models/order.model';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { OrderReviewStepComponent } from './order-review-step.component';

const PRODUCT: CatalogProduct = {
  id: 'p-a',
  category: 'Llaveros',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

const CUSTOMER_INFO = { fullName: 'Ana Torres', email: 'ana@example.com', phone: '987654321' };
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
  id: 'PED-MOCK-1',
  placedAt: new Date('2026-09-07T00:00:00Z'),
  status: 'pendiente',
  kind: 'estandar',
  summary: '1 unidad: Llavero A',
  statusHistory: [
    {
      previousStatus: null,
      newStatus: 'pendiente',
      changedAt: new Date('2026-09-07T00:00:00Z'),
      responsible: 'Sistema',
      note: 'Pedido registrado. Pendiente de confirmación.',
    },
  ],
};

describe('OrderReviewStepComponent', () => {
  let fixture: ComponentFixture<OrderReviewStepComponent>;
  let component: OrderReviewStepComponent;
  let cart: CartStateService;
  let checkoutState: CheckoutStateService;
  let router: Router;

  function setup(createStandardOrder: (...args: never[]) => Observable<OrderDetailViewModel>): void {
    TestBed.configureTestingModule({
      imports: [OrderReviewStepComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
        {
          provide: CustomerOrdersMockService,
          useValue: { createStandardOrder },
        },
      ],
    });
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

  it('accurately reflects cart contents plus typed customer/delivery info', () => {
    setup(() => of(CREATED_ORDER));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('Ana Torres');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Av. Los Álamos 123');
    expect(text).toContain('Miraflores');
    // No payment-processed claim anywhere on this step.
    expect(text.toLowerCase()).not.toContain('pago procesado');
  });

  it('calls createStandardOrder with the cart items and typed info, clears the cart only on success, and navigates to confirmation', fakeAsync(() => {
    const spy = jasmine.createSpy('createStandardOrder').and.returnValue(of(CREATED_ORDER));
    setup(spy);
    const navigateSpy = spyOn(router, 'navigateByUrl');

    component.submit();
    tick();

    expect(spy).toHaveBeenCalledTimes(1);
    const [items, customerInfo, deliveryInfo] = spy.calls.mostRecent().args;
    expect(items.length).toBe(1);
    expect(items[0].productId).toBe('p-a');
    expect(customerInfo).toEqual(CUSTOMER_INFO);
    expect(deliveryInfo).toEqual(DELIVERY_INFO);

    expect(cart.isEmpty()).toBe(true);
    expect(checkoutState.placedOrder()).toEqual({
      id: 'PED-MOCK-1',
      status: 'pendiente',
      placedAt: CREATED_ORDER.placedAt,
      summary: CREATED_ORDER.summary,
    });
    expect(navigateSpy).toHaveBeenCalledWith('/checkout/confirmacion');
  }));

  it('on failure shows a generic error, does NOT clear the cart, and allows retry', fakeAsync(() => {
    setup(() => throwError(() => new OrdersMockError('boom')));

    component.submit();
    tick();

    expect(component.errorMessage()).toBeTruthy();
    expect(cart.isEmpty()).toBe(false);
    expect(checkoutState.placedOrder()).toBeNull();
    expect(component.submitting()).toBe(false);
  }));

  it('double-clicking submit results in only one call while a request is in flight', fakeAsync(() => {
    const spy = jasmine.createSpy('createStandardOrder').and.returnValue(of(CREATED_ORDER));
    setup(spy);
    spyOn(router, 'navigateByUrl');

    component.submit();
    component.submit();
    tick();

    expect(spy).toHaveBeenCalledTimes(1);
  }));
});
