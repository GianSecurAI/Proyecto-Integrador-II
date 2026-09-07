import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminOrdersMockError, AdminOrdersMockService } from './admin-orders-mock.service';
import { RegisterPersonalizedOrderFormValue } from '../models/admin-order.model';

/**
 * Covers the mock service directly (not just through a page), per this task's own requirement to
 * "unit-test the service directly" for the defensive invalid-transition rejection — the same
 * "don't trust client-side validation alone" spirit as Constitution Principle VIII, applied here
 * even inside a frontend-only mock.
 */
describe('AdminOrdersMockService', () => {
  let service: AdminOrdersMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminOrdersMockService);
  });

  it('lists orders spanning multiple customers', fakeAsync(() => {
    let result: unknown[] = [];
    service.getOrders().subscribe((orders) => (result = orders));
    tick(400);

    expect(result.length).toBeGreaterThan(0);
    const emails = new Set(
      (result as { customerEmail: string }[]).map((order) => order.customerEmail),
    );
    expect(emails.size).toBeGreaterThanOrEqual(3);
  }));

  it('returns a real not-found error for an unknown order id', fakeAsync(() => {
    let error: unknown;
    service.getOrderById('no-existe').subscribe({ error: (e) => (error = e) });
    tick(400);

    expect(error).toBeInstanceOf(AdminOrdersMockError);
  }));

  it('applies a valid status transition and appends a history entry', fakeAsync(() => {
    let updated: { status: string; statusHistory: unknown[] } | undefined;
    // PED-3003 seeded at 'pendiente' — 'confirmado' is an allowed next status.
    service.transitionStatus('PED-3003', 'confirmado', 'Pago verificado').subscribe((order) => {
      updated = order as never;
    });
    tick(400);

    expect(updated?.status).toBe('confirmado');
    expect(updated?.statusHistory.length).toBe(2);
  }));

  it('rejects an invalid status transition even when called directly (defense in depth)', fakeAsync(() => {
    let error: unknown;
    // PED-3003 seeded at 'pendiente' — 'entregado' is NOT an allowed direct next status.
    service.transitionStatus('PED-3003', 'entregado').subscribe({ error: (e) => (error = e) });
    tick(400);

    expect(error).toBeInstanceOf(AdminOrdersMockError);
  }));

  it('rejects any transition out of a terminal status', fakeAsync(() => {
    let error: unknown;
    // PED-3001 seeded at 'entregado' — terminal, no allowed next statuses.
    service.transitionStatus('PED-3001', 'cancelado').subscribe({ error: (e) => (error = e) });
    tick(400);

    expect(error).toBeInstanceOf(AdminOrdersMockError);
  }));

  it('registers a new personalized order as "confirmado" when payment is attested', fakeAsync(() => {
    const value: RegisterPersonalizedOrderFormValue = {
      customerEmail: 'nuevo.cliente@example.com',
      quotationDescription: 'Pieza personalizada acordada por WhatsApp',
      quotationAmount: 120,
      paymentConfirmed: true,
    };
    let created: { kind: string; status: string; customerEmail: string } | undefined;
    service.registerPersonalizedOrder(value).subscribe((order) => (created = order as never));
    tick(500);

    expect(created?.kind).toBe('personalizado');
    expect(created?.status).toBe('confirmado');
    expect(created?.customerEmail).toBe('nuevo.cliente@example.com');
  }));

  it('rejects registering a personalized order without the payment attestation, defensively', fakeAsync(() => {
    const value: RegisterPersonalizedOrderFormValue = {
      customerEmail: 'sin.pago@example.com',
      quotationDescription: 'Pieza sin pago confirmado',
      quotationAmount: 50,
      paymentConfirmed: false,
    };
    let error: unknown;
    service.registerPersonalizedOrder(value).subscribe({ error: (e) => (error = e) });
    tick(400);

    expect(error).toBeInstanceOf(AdminOrdersMockError);
  }));
});
