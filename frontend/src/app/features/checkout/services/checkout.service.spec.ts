import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CartItem } from '../../cart/models/cart-item.model';
import { CHECKOUT_ID, makeCheckout, makeFile } from '../testing/checkout-fixtures';
import { CheckoutService, buildCheckoutRequest } from './checkout.service';

const CART: CartItem[] = [
  { productId: 5, title: 'Llavero', category: 'LLAVERO', subcategory: 'x', unitPrice: 12.5, quantity: 2 },
  { productId: 6, title: 'Pegatinas', category: 'PEGATINAS', subcategory: 'y', unitPrice: 4, quantity: 1 },
];
const CUSTOMER = { fullName: ' Ana Torres ', phone: '987 654 321' };
const DELIVERY = { address: ' Av. Larco 345 ', district: 'Miraflores', notes: '' };

describe('buildCheckoutRequest', () => {
  it('maps the cart to { productId, quantity } only — prices and titles cannot leak', () => {
    const request = buildCheckoutRequest(CART, CUSTOMER, DELIVERY);
    expect(request.items).toEqual([
      { productId: 5, quantity: 2 },
      { productId: 6, quantity: 1 },
    ]);
    const json = JSON.stringify(request);
    for (const forbidden of ['unitPrice', '12.5', 'title', 'status', 'total']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('trims fields, sends contact and delivery, and omits blank notes', () => {
    const request = buildCheckoutRequest(CART, CUSTOMER, DELIVERY);
    expect(request.contact).toEqual({ fullName: 'Ana Torres', phone: '987 654 321' });
    expect(request.delivery).toEqual({ address: 'Av. Larco 345', district: 'Miraflores' });
    expect(buildCheckoutRequest(CART, CUSTOMER, { ...DELIVERY, notes: ' Timbre 2 ' }).delivery.notes).toBe('Timbre 2');
  });
});

describe('CheckoutService', () => {
  let service: CheckoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CheckoutService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('POST /api/checkout sends the body with the Idempotency-Key header', () => {
    const request = buildCheckoutRequest(CART, CUSTOMER, DELIVERY);
    let result: unknown;
    service.create(request, 'key-1').subscribe((c) => (result = c));
    const req = http.expectOne('/api/checkout');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(req.request.body).toEqual(request);
    req.flush(makeCheckout(), { status: 201, statusText: 'Created' });
    expect((result as { checkoutId: string }).checkoutId).toBe(CHECKOUT_ID);
  });

  it('GET /api/checkout/{id} returns the CheckoutDto as is', () => {
    let result: unknown;
    service.get(CHECKOUT_ID).subscribe((c) => (result = c));
    const body = makeCheckout({ status: 'PAID', orderId: 'PED-000123', expiresAt: null });
    http.expectOne(`/api/checkout/${CHECKOUT_ID}`).flush(body);
    expect(result).toEqual(body);
  });

  it('POST /api/checkout/{id}/cancel has no body', () => {
    service.cancel(CHECKOUT_ID).subscribe();
    const req = http.expectOne(`/api/checkout/${CHECKOUT_ID}/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(makeCheckout({ status: 'CANCELLED', expiresAt: null }));
  });

  it('uploads the proof as multipart FormData (file, method, operationCode) with credentials and no manual Content-Type', () => {
    const file = makeFile('captura.png', 'image/png');
    service.uploadProof(CHECKOUT_ID, file, 'PLIN', ' AB12CD34 ').subscribe();
    const req = http.expectOne(`/api/checkout/${CHECKOUT_ID}/proof`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Content-Type')).toBeFalse();
    const form = req.request.body as FormData;
    expect(form instanceof FormData).toBeTrue();
    expect(form.get('file')).toBe(file);
    expect(form.get('method')).toBe('PLIN');
    expect(form.get('operationCode')).toBe('AB12CD34');
    req.flush(makeCheckout({ status: 'PROOF_SUBMITTED' }));
  });

  it('omits operationCode when blank', () => {
    service.uploadProof(CHECKOUT_ID, makeFile(), 'YAPE', '  ').subscribe();
    const req = http.expectOne(`/api/checkout/${CHECKOUT_ID}/proof`);
    expect((req.request.body as FormData).has('operationCode')).toBeFalse();
    req.flush(makeCheckout());
  });

  it('fetches the own proof image as a blob with credentials', () => {
    let blob: Blob | undefined;
    service.proofImage(CHECKOUT_ID, 'att 1').subscribe((b) => (blob = b));
    const req = http.expectOne(`/api/checkout/${CHECKOUT_ID}/proof/att%201`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(new Blob(['x'], { type: 'image/png' }));
    expect(blob?.type).toBe('image/png');
  });
});
