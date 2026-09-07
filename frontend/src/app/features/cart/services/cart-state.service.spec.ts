import { TestBed } from '@angular/core/testing';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CartItem } from '../models/cart-item.model';
import { CART_STORAGE_ADAPTER, CartStorageAdapter, CartStorageError } from './cart-storage.adapter';
import { CartStateService } from './cart-state.service';

const PRODUCT_A: CatalogProduct = {
  id: 'p-a',
  category: 'Llaveros',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

const PRODUCT_B: CatalogProduct = {
  id: 'p-b',
  category: 'Figuras',
  subcategory: 'Coleccionables',
  title: 'Figura B',
  price: 45.5,
};

/** In-memory fake, isolated from real `localStorage` — service-level tests should not depend on
 * the browser storage mechanics, which are covered separately below/in the adapter's own specs. */
class FakeCartStorageAdapter implements CartStorageAdapter {
  private saved: readonly CartItem[] = [];
  loadError: Error | null = null;

  load(): readonly CartItem[] {
    if (this.loadError) throw this.loadError;
    return this.saved;
  }

  save(items: readonly CartItem[]): void {
    this.saved = items;
  }

  clear(): void {
    this.saved = [];
  }
}

describe('CartStateService', () => {
  let service: CartStateService;
  let fakeAdapter: FakeCartStorageAdapter;

  beforeEach(() => {
    fakeAdapter = new FakeCartStorageAdapter();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE_ADAPTER, useValue: fakeAdapter }],
    });
    service = TestBed.inject(CartStateService);
  });

  it('starts empty when storage has nothing saved', () => {
    expect(service.isEmpty()).toBeTrue();
    expect(service.items().length).toBe(0);
    expect(service.itemCount()).toBe(0);
    expect(service.subtotal()).toBe(0);
    expect(service.status()).toBe('ready');
  });

  it('adding an item adds it to cart state', () => {
    service.addItem(PRODUCT_A, 1);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].productId).toBe('p-a');
    expect(service.items()[0].quantity).toBe(1);
  });

  it('adding the same product a second time increases quantity instead of duplicating the row', () => {
    service.addItem(PRODUCT_A, 1);
    service.addItem(PRODUCT_A, 2);

    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(3);
    expect(service.itemCount()).toBe(3);
  });

  it('increasing/decreasing quantity updates state and the line subtotal correctly', () => {
    service.addItem(PRODUCT_A, 1);
    service.setQuantity('p-a', 4);
    expect(service.items()[0].quantity).toBe(4);
    expect(service.subtotal()).toBe(79.6);

    service.setQuantity('p-a', 2);
    expect(service.items()[0].quantity).toBe(2);
    expect(service.subtotal()).toBe(39.8);
  });

  it('clamps an invalid quantity (zero/negative/non-finite) to 1 instead of accepting it', () => {
    service.addItem(PRODUCT_A, 1);
    service.setQuantity('p-a', 0);
    expect(service.items()[0].quantity).toBe(1);

    service.setQuantity('p-a', -5);
    expect(service.items()[0].quantity).toBe(1);

    service.setQuantity('p-a', Number.NaN);
    expect(service.items()[0].quantity).toBe(1);
  });

  it('removing an item removes exactly that line, leaving others untouched', () => {
    service.addItem(PRODUCT_A, 1);
    service.addItem(PRODUCT_B, 2);

    service.removeItem('p-a');

    expect(service.items().length).toBe(1);
    expect(service.items()[0].productId).toBe('p-b');
    expect(service.items()[0].quantity).toBe(2);
  });

  it('computes the subtotal correctly across multiple lines with different quantities', () => {
    service.addItem(PRODUCT_A, 2); // 39.80
    service.addItem(PRODUCT_B, 3); // 136.50
    expect(service.subtotal()).toBe(176.3);
    expect(service.itemCount()).toBe(5);
  });

  it('clearCart empties the cart and clears storage', () => {
    service.addItem(PRODUCT_A, 1);
    service.clearCart();
    expect(service.isEmpty()).toBeTrue();
  });

  it('persists mutations through the injected storage adapter (never localStorage directly)', () => {
    const saveSpy = spyOn(fakeAdapter, 'save').and.callThrough();
    service.addItem(PRODUCT_A, 1);
    expect(saveSpy).toHaveBeenCalled();
  });

  it('surfaces a real storage load failure as an error status, recoverable via continueWithEmptyCart', () => {
    fakeAdapter.loadError = new CartStorageError('boom');
    // Re-inject to re-run construction against the failing adapter.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE_ADAPTER, useValue: fakeAdapter }],
    });
    const failing = TestBed.inject(CartStateService);

    expect(failing.status()).toBe('error');
    expect(failing.items().length).toBe(0);

    failing.continueWithEmptyCart();
    expect(failing.status()).toBe('ready');
  });
});
