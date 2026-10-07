import { TestBed } from '@angular/core/testing';
import { CheckoutStateService } from './checkout-state.service';

describe('CheckoutStateService', () => {
  let service: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheckoutStateService);
  });

  it('starts with no customer info, delivery info, or pending checkout', () => {
    expect(service.customerInfo()).toBeNull();
    expect(service.deliveryInfo()).toBeNull();
    expect(service.pendingCheckoutId()).toBeNull();
  });

  it('retains the last set customer and delivery info', () => {
    service.setCustomerInfo({ fullName: 'Ana', phone: '999999999' });
    service.setDeliveryInfo({ address: 'Calle 1', district: 'San Isidro', notes: '' });
    expect(service.customerInfo()).toEqual({ fullName: 'Ana', phone: '999999999' });
    expect(service.deliveryInfo()?.district).toBe('San Isidro');
  });

  it('remembers the checkout awaiting payment until it is cleared', () => {
    service.setPendingCheckoutId('c-1');
    expect(service.pendingCheckoutId()).toBe('c-1');
    service.setPendingCheckoutId(null);
    expect(service.pendingCheckoutId()).toBeNull();
  });

  it('clearFormData forgets the typed data but KEEPS the attempt key (same cart re-submits the same checkout)', () => {
    service.setCustomerInfo({ fullName: 'Ana', phone: '999999999' });
    service.setDeliveryInfo({ address: 'Calle 1', district: 'San Isidro', notes: '' });
    const first = service.idempotencyKeyFor({ a: 1 });
    service.clearFormData();
    expect(service.customerInfo()).toBeNull();
    expect(service.deliveryInfo()).toBeNull();
    expect(service.idempotencyKeyFor({ a: 1 })).toBe(first);
  });

  describe('Idempotency-Key per checkout attempt', () => {
    it('is a UUID and is reused for an unchanged request (safe retry/replay)', () => {
      const body = { items: [{ productId: 1, quantity: 1 }] };
      const first = service.idempotencyKeyFor(body);
      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(service.idempotencyKeyFor({ items: [{ productId: 1, quantity: 1 }] })).toBe(first);
    });

    it('changes when the request body changes (server would answer 409 for a reused key)', () => {
      const first = service.idempotencyKeyFor({ items: [{ productId: 1, quantity: 1 }] });
      const second = service.idempotencyKeyFor({ items: [{ productId: 1, quantity: 2 }] });
      expect(second).not.toBe(first);
    });

    it('resetAttempt forces a new key', () => {
      const body = { a: 1 };
      const first = service.idempotencyKeyFor(body);
      service.resetAttempt();
      expect(service.idempotencyKeyFor(body)).not.toBe(first);
    });

    it('resetForm forgets the form data and the attempt', () => {
      service.setCustomerInfo({ fullName: 'Ana', phone: '999999999' });
      const first = service.idempotencyKeyFor({ a: 1 });
      service.setPendingCheckoutId('c-1');
      service.resetForm();
      expect(service.customerInfo()).toBeNull();
      expect(service.pendingCheckoutId()).toBeNull();
      expect(service.idempotencyKeyFor({ a: 1 })).not.toBe(first);
    });
  });
});
