import { TestBed } from '@angular/core/testing';
import { CheckoutStateService } from './checkout-state.service';

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

  it('retains the last set customer info', () => {
    const value = { fullName: 'Ana', email: 'ana@example.com', phone: '999999999' };
    service.setCustomerInfo(value);
    expect(service.customerInfo()).toEqual(value);
  });

  it('retains the last set delivery info', () => {
    const value = { address: 'Calle 1', district: 'San Isidro', notes: '' };
    service.setDeliveryInfo(value);
    expect(service.deliveryInfo()).toEqual(value);
  });

  it('retains the placed order reference once set', () => {
    const placedAt = new Date('2026-09-07T00:00:00Z');
    service.setPlacedOrder({ id: 'PED-MOCK-1', status: 'pendiente', placedAt, summary: '1 unidad: Llavero A' });
    expect(service.placedOrder()).toEqual({
      id: 'PED-MOCK-1',
      status: 'pendiente',
      placedAt,
      summary: '1 unidad: Llavero A',
    });
  });
});
