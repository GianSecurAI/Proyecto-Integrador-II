import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CartItem } from '../../cart/models/cart-item.model';
import {
  CustomerOrdersMockService,
  MOCK_ORDER_SUBMIT_FAILURE_MARKER,
  OrdersMockError,
} from './customer-orders-mock.service';

const ITEMS: readonly CartItem[] = [
  { productId: 'p-a', title: 'Llavero A', category: 'Llaveros', subcategory: 'Personalizados', unitPrice: 19.9, quantity: 2 },
  { productId: 'p-b', title: 'Maceta B', category: 'Hogar', subcategory: 'Macetas', unitPrice: 30, quantity: 1 },
];

const CUSTOMER_INFO = { fullName: 'María Gómez', email: 'maria@example.com', phone: '987654321' };
const DELIVERY_INFO = { address: 'Av. Siempre Viva 123', district: 'Miraflores', notes: '' };

describe('CustomerOrdersMockService.createStandardOrder', () => {
  let service: CustomerOrdersMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomerOrdersMockService);
  });

  it('creates a new order starting at "pendiente" (never "confirmado") with no payment-processed language', fakeAsync(() => {
    let created: { id: string; status: string; kind: string; statusHistory: { note: string | null }[] } | undefined;
    service.createStandardOrder(ITEMS, CUSTOMER_INFO, DELIVERY_INFO).subscribe((order) => {
      created = order as never;
    });
    tick(500);

    expect(created?.status).toBe('pendiente');
    expect(created?.kind).toBe('estandar');
    expect(created?.id).toMatch(/^PED-MOCK-\d+$/);
    expect(created?.statusHistory.length).toBe(1);
    const note = created?.statusHistory[0].note ?? '';
    expect(note.toLowerCase()).not.toContain('pago');
    expect(note.toLowerCase()).not.toContain('payment');
    expect(note).toContain('Pendiente de confirmación');
  }));

  it('immediately appears in getOrders() after creation', fakeAsync(() => {
    let createdId = '';
    service.createStandardOrder(ITEMS, CUSTOMER_INFO, DELIVERY_INFO).subscribe((order) => {
      createdId = order.id;
    });
    tick(500);

    let orders: { id: string }[] = [];
    service.getOrders().subscribe((result) => (orders = result));
    tick(400);

    expect(orders.some((order) => order.id === createdId)).toBe(true);
  }));

  it('fails deterministically when the address contains the mock failure marker', fakeAsync(() => {
    let error: unknown;
    service
      .createStandardOrder(ITEMS, CUSTOMER_INFO, {
        ...DELIVERY_INFO,
        address: `Av. Falsa 123 ${MOCK_ORDER_SUBMIT_FAILURE_MARKER}`,
      })
      .subscribe({ error: (e) => (error = e) });
    tick(500);

    expect(error).toBeInstanceOf(OrdersMockError);
  }));
});
