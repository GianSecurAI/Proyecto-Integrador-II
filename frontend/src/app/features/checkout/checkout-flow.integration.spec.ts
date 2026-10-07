import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartStateService } from '../cart/services/cart-state.service';
import { CART_STORAGE_ADAPTER } from '../cart/services/cart-storage.adapter';
import { CheckoutDto } from './models/checkout.model';
import { CheckoutService, buildCheckoutRequest } from './services/checkout.service';
import { CheckoutStateService } from './state/checkout-state.service';

/** Body copied from backend-foundation.md section 24.1 (`CheckoutDto`). */
const CREATED: CheckoutDto = {
  checkoutId: '3f2b8c1e-0000-4000-8000-000000000001',
  status: 'AWAITING_PAYMENT_PROOF',
  orderId: null,
  totalAmount: 31,
  currency: 'PEN',
  createdAt: '2026-10-07T17:00:00Z',
  expiresAt: '2026-10-08T17:00:00Z',
  items: [],
  paymentInstructions: { methods: ['YAPE', 'PLIN'], amount: 31, currency: 'PEN', reference: 'AM3D-3F2B8C1E' },
  proofStatus: 'NONE',
  rejectionReason: null,
  attemptsRemaining: 5,
  attempts: [],
};

/**
 * Cross-feature SEAM test: REAL `CartStateService` -> REAL request builder -> REAL
 * `CheckoutService` over `HttpTestingController`. A product added through
 * `CartStateService.addItem()` must reach `POST /api/checkout` as `{ productId, quantity }` ONLY,
 * the amount the checkout keeps is the SERVER's, and creating the checkout never empties the cart.
 */
describe('Cart -> Checkout -> POST /api/checkout (integration seam)', () => {
  let cart: CartStateService;
  let checkoutService: CheckoutService;
  let http: HttpTestingController;
  let checkout: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CART_STORAGE_ADAPTER,
          useValue: { load: () => [], save: () => undefined, clear: () => undefined },
        },
      ],
    });
    cart = TestBed.inject(CartStateService);
    checkoutService = TestBed.inject(CheckoutService);
    http = TestBed.inject(HttpTestingController);
    checkout = TestBed.inject(CheckoutStateService);
  });
  afterEach(() => http.verify());

  it('carries only product id and quantity, keeps the SERVER amount and leaves the cart intact', () => {
    cart.addItem({ id: 5, title: 'Llavero', category: 'LLAVERO', subcategory: 'x', price: 12.5 }, 2);
    cart.addItem({ id: 6, title: 'Pegatinas', category: 'PEGATINAS', subcategory: 'y', price: 4 }, 1);

    const request = buildCheckoutRequest(
      cart.items(),
      { fullName: 'Ana Torres', phone: '987654321' },
      { address: 'Av. Larco 345', district: 'Miraflores', notes: '' },
    );
    let created: CheckoutDto | undefined;
    checkoutService.create(request, checkout.idempotencyKeyFor(request)).subscribe((c) => (created = c));

    const req = http.expectOne('/api/checkout');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.request.body.items).toEqual([
      { productId: 5, quantity: 2 },
      { productId: 6, quantity: 1 },
    ]);
    expect(JSON.stringify(req.request.body)).not.toContain('unitPrice');
    req.flush(CREATED, { status: 201, statusText: 'Created' });

    expect(created!.totalAmount).toBe(31); // server value, not the 29 cart snapshot
    expect(cart.subtotal()).toBe(29);
    expect(cart.isEmpty()).toBe(false);
  });
});
