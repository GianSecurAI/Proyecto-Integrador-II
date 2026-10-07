import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartStateService } from '../cart/services/cart-state.service';
import { CART_STORAGE_ADAPTER } from '../cart/services/cart-storage.adapter';
import {
  StandardOrdersService,
  buildPlaceOrderRequest,
} from './services/standard-orders.service';
import { CheckoutStateService } from './state/checkout-state.service';

/**
 * Cross-feature SEAM test: REAL `CartStateService` -> REAL request builder -> REAL
 * `StandardOrdersService` over `HttpTestingController` (no stand-in for any of them). A product
 * added through `CartStateService.addItem()` must reach `POST /api/orders` as `{ productId,
 * quantity }` ONLY, and the order the server returns (server price/status) is what the checkout
 * keeps — never the cart snapshot. The response body is copied from the backend's
 * `OrderResponseDto`.
 */
describe('Cart -> Checkout -> POST /api/orders (integration seam)', () => {
  let cart: CartStateService;
  let orders: StandardOrdersService;
  let http: HttpTestingController;
  let checkout: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Real LocalStorage adapter would work too; a throwaway scope keeps the test hermetic.
        {
          provide: CART_STORAGE_ADAPTER,
          useValue: { load: () => [], save: () => undefined, clear: () => undefined },
        },
      ],
    });
    cart = TestBed.inject(CartStateService);
    orders = TestBed.inject(StandardOrdersService);
    http = TestBed.inject(HttpTestingController);
    checkout = TestBed.inject(CheckoutStateService);
  });
  afterEach(() => http.verify());

  it('carries only product id and quantity from the cart to the request, and keeps the SERVER order', () => {
    cart.addItem({ id: 5, title: 'Llavero', category: 'LLAVERO', subcategory: 'x', price: 12.5 }, 2);
    cart.addItem({ id: 6, title: 'Pegatinas', category: 'PEGATINAS', subcategory: 'y', price: 4 }, 1);

    const request = buildPlaceOrderRequest(
      cart.items(),
      { fullName: 'Ana Torres', phone: '987654321' },
      { address: 'Av. Larco 345', district: 'Miraflores', notes: '' },
    );
    let created: { id: string; totalAmount: number } | undefined;
    orders.place(request, checkout.idempotencyKeyFor(request)).subscribe((o) => (created = o));

    const req = http.expectOne('/api/orders');
    expect(req.request.body.items).toEqual([
      { productId: 5, quantity: 2 },
      { productId: 6, quantity: 1 },
    ]);
    expect(JSON.stringify(req.request.body)).not.toContain('unitPrice');
    // The server may price differently from the cart snapshot; the client shows the server value.
    req.flush(
      {
        id: 'PED-20261006-0009',
        placedAt: '2026-10-06T15:30:00Z',
        status: 'CONFIRMADO',
        kind: 'ESTANDAR',
        summary: '3 unidades: Llavero y 1 producto más',
        totalAmount: 31,
        items: [],
        delivery: null,
        statusHistory: [],
      },
      { status: 201, statusText: 'Created' },
    );
    expect(created!.id).toBe('PED-20261006-0009');
    expect(created!.totalAmount).toBe(31);
    expect(cart.subtotal()).toBe(29); // untouched snapshot — the cart is cleared by the review step
  });
});
