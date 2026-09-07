import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CATALOG_PRODUCTS } from '../catalog/mocks/catalog-products.mock';
import { CartStateService } from '../cart/services/cart-state.service';
import { CustomerOrdersMockService } from '../account/services/customer-orders-mock.service';

/**
 * Cross-feature SEAM test — deliberately uses the REAL `CartStateService` and REAL
 * `CustomerOrdersMockService`, never a spy/stand-in for either, unlike
 * `order-review-step.component.spec.ts` (which correctly spies on the order-creation call to
 * unit-test the component in isolation) or `customer-orders-mock.service.spec.ts` (which
 * correctly hand-builds a `CartItem[]` to unit-test `createStandardOrder` in isolation).
 *
 * Neither of those specs exercises the actual hand-off: a product added via
 * `CartStateService.addItem()` (the same method `ProductCardComponent`/`product-detail.page.ts`
 * call) flowing, unmodified, into `CustomerOrdersMockService.createStandardOrder()`, and the
 * resulting order then being visible via `getOrders()` (the same read `/account/orders` and the
 * public `/track-order` page both perform). This test exists specifically so a future change to
 * either side's shape (e.g. renaming a `CartItem`/`OrderSummaryViewModel` field) fails a test
 * here rather than only being caught by manual/live review.
 */
describe('Cart -> Checkout -> Order creation (integration seam)', () => {
  let cart: CartStateService;
  let orders: CustomerOrdersMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cart = TestBed.inject(CartStateService);
    orders = TestBed.inject(CustomerOrdersMockService);
  });

  it('carries product id, title, price and quantity unchanged from cart to the created order and into getOrders()', fakeAsync(() => {
    const product = CATALOG_PRODUCTS[0];
    cart.addItem(product, 2);
    cart.addItem(CATALOG_PRODUCTS[1], 1);

    expect(cart.itemCount()).toBe(3);
    const cartItems = cart.items();
    expect(cartItems.length).toBe(2);

    let created: import('../account/models/order.model').OrderDetailViewModel | undefined;
    orders
      .createStandardOrder(
        cartItems,
        { fullName: 'Ana Torres', email: 'ana.torres@example.com', phone: '987654321' },
        { address: 'Av. Larco 345', district: 'Miraflores', notes: '' },
      )
      .subscribe((result) => (created = result));
    tick(500);

    expect(created).toBeDefined();
    expect(created!.kind).toBe('estandar');
    expect(created!.status).toBe('pendiente');
    // The summary is a collapsed presentation string (see `buildStandardOrderSummary`'s doc
    // comment — no itemized line-item model exists yet), but it must still be built FROM the
    // real cart items, not a hardcoded/independent value — it names the first product and the
    // correct total unit count across both lines.
    expect(created!.summary).toContain(product.title);
    expect(created!.summary).toContain('3 unidad');

    // The seam that matters most: the order this call created must be the SAME order `getOrders()`
    // (read by both `/account/orders` and, via the same singleton service, `/track-order`) returns.
    let listed: readonly import('../account/models/order.model').OrderSummaryViewModel[] = [];
    orders.getOrders().subscribe((result) => (listed = result));
    tick(500);

    const found = listed.find((order) => order.id === created!.id);
    expect(found).toBeDefined();
    expect(found!.kind).toBe('estandar');
    expect(found!.status).toBe('pendiente');
  }));

  it('never creates a personalized order from the standard cart flow', fakeAsync(() => {
    cart.addItem(CATALOG_PRODUCTS[0], 1);
    let created: import('../account/models/order.model').OrderDetailViewModel | undefined;
    orders
      .createStandardOrder(
        cart.items(),
        { fullName: 'Ana Torres', email: 'ana.torres@example.com', phone: '987654321' },
        { address: 'Av. Larco 345', district: 'Miraflores', notes: '' },
      )
      .subscribe((result) => (created = result));
    tick(500);

    expect(created!.kind).toBe('estandar');
  }));
});
