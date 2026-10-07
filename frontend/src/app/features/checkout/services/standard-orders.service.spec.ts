import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartItem } from '../../cart/models/cart-item.model';
import { StandardOrdersService, buildPlaceOrderRequest } from './standard-orders.service';

const CART: CartItem[] = [
  { productId: 5, title: 'Llavero', category: 'LLAVERO', subcategory: 'x', unitPrice: 12.5, quantity: 2 },
  { productId: 6, title: 'Pegatinas', category: 'PEGATINAS', subcategory: 'y', unitPrice: 4, quantity: 1 },
];
const CUSTOMER = { fullName: ' Ana Torres ', phone: '987 654 321' };
const DELIVERY = { address: ' Av. Larco 345 ', district: 'Miraflores', notes: '' };

/** Shape copied from backend `OrderResponseDto` (POST /api/orders 201 body). */
const CREATED = {
  id: 'PED-20261006-0001',
  placedAt: '2026-10-06T15:30:00Z',
  status: 'PENDIENTE',
  kind: 'ESTANDAR',
  summary: '3 unidades: Llavero y 1 producto más',
  totalAmount: 29,
  items: [
    { productId: 5, title: 'Llavero', unitPrice: 12.5, quantity: 2, lineTotal: 25 },
    { productId: 6, title: 'Pegatinas', unitPrice: 4, quantity: 1, lineTotal: 4 },
  ],
  delivery: { address: 'Av. Larco 345', district: 'Miraflores', notes: null },
  statusHistory: [
    {
      previousStatus: null,
      newStatus: 'PENDIENTE',
      changedAt: '2026-10-06T15:30:00Z',
      responsible: 'Sistema',
      note: null,
    },
  ],
};

describe('buildPlaceOrderRequest', () => {
  it('maps the cart to { productId, quantity } only — prices and titles cannot leak', () => {
    const request = buildPlaceOrderRequest(CART, CUSTOMER, DELIVERY);
    expect(request.items).toEqual([
      { productId: 5, quantity: 2 },
      { productId: 6, quantity: 1 },
    ]);
    const json = JSON.stringify(request);
    expect(json).not.toContain('unitPrice');
    expect(json).not.toContain('12.5');
    expect(json).not.toContain('title');
    expect(json).not.toContain('status');
    expect(json).not.toContain('total');
  });

  it('trims fields, sends contact and delivery, and omits blank notes', () => {
    const request = buildPlaceOrderRequest(CART, CUSTOMER, DELIVERY);
    expect(request.contact).toEqual({ fullName: 'Ana Torres', phone: '987 654 321' });
    expect(request.delivery).toEqual({ address: 'Av. Larco 345', district: 'Miraflores' });
    const withNotes = buildPlaceOrderRequest(CART, CUSTOMER, { ...DELIVERY, notes: ' Timbre 2 ' });
    expect(withNotes.delivery.notes).toBe('Timbre 2');
  });
});

describe('StandardOrdersService (POST /api/orders)', () => {
  let service: StandardOrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StandardOrdersService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('POSTs the request with an Idempotency-Key header and maps the server order', () => {
    const request = buildPlaceOrderRequest(CART, CUSTOMER, DELIVERY);
    let order: import('../../account/models/order.model').OrderDetailViewModel | undefined;
    service.place(request, '3f2b8c1e-0000-4000-8000-000000000001').subscribe((o) => (order = o));
    const req = http.expectOne('/api/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('3f2b8c1e-0000-4000-8000-000000000001');
    expect(req.request.body).toEqual(request);
    req.flush(CREATED, { status: 201, statusText: 'Created' });
    expect(order!.id).toBe('PED-20261006-0001');
    expect(order!.status).toBe('PENDIENTE');
    expect(order!.totalAmount).toBe(29);
    expect(order!.placedAt instanceof Date).toBeTrue();
    expect(order!.items.length).toBe(2);
  });

  it('surfaces 409 PRODUCT_UNAVAILABLE as an error carrying the backend code', () => {
    let error: unknown;
    service.place(buildPlaceOrderRequest(CART, CUSTOMER, DELIVERY), 'k').subscribe({
      error: (e) => (error = e),
    });
    http
      .expectOne('/api/orders')
      .flush(
        { code: 'PRODUCT_UNAVAILABLE', message: 'One or more products are not available.', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect((error as { status: number }).status).toBe(409);
  });
});
