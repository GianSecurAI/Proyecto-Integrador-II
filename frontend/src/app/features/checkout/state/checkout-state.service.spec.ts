import { TestBed } from '@angular/core/testing';
import { OrderDetailViewModel } from '../../account/models/order.model';
import { CheckoutStateService } from './checkout-state.service';

const ORDER: OrderDetailViewModel = {
  id: 'PED-1',
  placedAt: new Date('2026-09-07T00:00:00Z'),
  status: 'PENDIENTE',
  kind: 'ESTANDAR',
  summary: '1 unidad: Llavero A',
  totalAmount: 10,
  items: [],
  delivery: null,
  statusHistory: [],
};

describe('CheckoutStateService', () => {
  let service: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheckoutStateService);
  });

  it('starts with no customer info, delivery info, or placed order', () => {
    expect(service.customerInfo()).toBeNull();
    expect(service.deliveryInfo()).toBeNull();
    expect(service.placedOrder()).toBeNull();
  });

  it('retains the last set customer and delivery info', () => {
    service.setCustomerInfo({ fullName: 'Ana', phone: '999999999' });
    service.setDeliveryInfo({ address: 'Calle 1', district: 'San Isidro', notes: '' });
    expect(service.customerInfo()).toEqual({ fullName: 'Ana', phone: '999999999' });
    expect(service.deliveryInfo()?.district).toBe('San Isidro');
  });

  it('retains the confirmed order exactly as the backend returned it', () => {
    service.setPlacedOrder(ORDER);
    expect(service.placedOrder()).toBe(ORDER);
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
      service.resetForm();
      expect(service.customerInfo()).toBeNull();
      expect(service.idempotencyKeyFor({ a: 1 })).not.toBe(first);
    });
  });
});
