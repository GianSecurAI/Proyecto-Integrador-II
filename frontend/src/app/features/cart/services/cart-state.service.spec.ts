import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStateService } from '../../../core/services/session-state.service';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CartItem } from '../models/cart-item.model';
import { CART_STORAGE_ADAPTER, CartStorageAdapter, CartStorageError } from './cart-storage.adapter';
import { CartStateService } from './cart-state.service';

const PRODUCT_A: CatalogProduct = {
  id: 1,
  category: 'LLAVERO',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

const PRODUCT_B: CatalogProduct = {
  id: 2,
  category: 'PEGATINAS',
  subcategory: 'Coleccionables',
  title: 'Figura B',
  price: 45.5,
};

/** In-memory fake, isolated from real `localStorage` — service-level tests should not depend on
 * the browser storage mechanics, which are covered separately below/in the adapter's own specs. */
class FakeCartStorageAdapter implements CartStorageAdapter {
  private readonly byScope = new Map<string, readonly CartItem[]>();
  private scope = 'guest';
  loadError: Error | null = null;

  load(): readonly CartItem[] {
    if (this.loadError) throw this.loadError;
    return this.byScope.get(this.scope) ?? [];
  }

  save(items: readonly CartItem[]): void {
    this.byScope.set(this.scope, items);
  }

  clear(): void {
    this.byScope.delete(this.scope);
  }

  useScope(scope: string): void {
    this.scope = scope;
  }

  peek(scope: string): readonly CartItem[] {
    return this.byScope.get(scope) ?? [];
  }
}

describe('CartStateService', () => {
  let service: CartStateService;
  let fakeAdapter: FakeCartStorageAdapter;

  beforeEach(() => {
    fakeAdapter = new FakeCartStorageAdapter();
    TestBed.configureTestingModule({
      providers: [
        { provide: CART_STORAGE_ADAPTER, useValue: fakeAdapter },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
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
    expect(service.items()[0].productId).toBe(1);
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
    service.setQuantity(1, 4);
    expect(service.items()[0].quantity).toBe(4);
    expect(service.subtotal()).toBe(79.6);

    service.setQuantity(1, 2);
    expect(service.items()[0].quantity).toBe(2);
    expect(service.subtotal()).toBe(39.8);
  });

  it('clamps an invalid quantity (zero/negative/non-finite) to 1 instead of accepting it', () => {
    service.addItem(PRODUCT_A, 1);
    service.setQuantity(1, 0);
    expect(service.items()[0].quantity).toBe(1);

    service.setQuantity(1, -5);
    expect(service.items()[0].quantity).toBe(1);

    service.setQuantity(1, Number.NaN);
    expect(service.items()[0].quantity).toBe(1);
  });

  it('removing an item removes exactly that line, leaving others untouched', () => {
    service.addItem(PRODUCT_A, 1);
    service.addItem(PRODUCT_B, 2);

    service.removeItem(1);

    expect(service.items().length).toBe(1);
    expect(service.items()[0].productId).toBe(2);
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

  it('caps a line quantity at 99 (backend limit) when adding or setting', () => {
    service.addItem(PRODUCT_A, 98);
    service.addItem(PRODUCT_A, 5);
    expect(service.items()[0].quantity).toBe(99);
    service.setQuantity(1, 500);
    expect(service.items()[0].quantity).toBe(99);
  });

  describe('per-user scope (ADR-cart-state follow-ups 1 and 2)', () => {
    it('keeps a guest cart in the guest scope', () => {
      service.addItem(PRODUCT_A, 1);
      expect(fakeAdapter.peek('guest').length).toBe(1);
    });

    it('moves the guest cart into the user scope on sign-in and merges quantities', () => {
      const session = TestBed.inject(SessionStateService);
      service.addItem(PRODUCT_A, 2);
      session.markAuthenticated('CLIENTE', 'a@b.pe', 7);
      TestBed.tick();
      expect(service.items()[0].quantity).toBe(2);
      expect(fakeAdapter.peek('user-7').length).toBe(1);
      expect(fakeAdapter.peek('guest').length).toBe(0);
    });

    it('clears the signed-in cart (memory and storage) when the session ends', () => {
      const session = TestBed.inject(SessionStateService);
      session.markAuthenticated('CLIENTE', 'a@b.pe', 7);
      TestBed.tick();
      service.addItem(PRODUCT_A, 1);
      expect(fakeAdapter.peek('user-7').length).toBe(1);
      session.clear(); // logout, or the 401 handler in the error interceptor
      TestBed.tick();
      expect(service.isEmpty()).toBeTrue();
      expect(fakeAdapter.peek('user-7').length).toBe(0);
    });

    it('does not leak one user cart to the next user on a shared browser', () => {
      const session = TestBed.inject(SessionStateService);
      session.markAuthenticated('CLIENTE', 'a@b.pe', 7);
      TestBed.tick();
      service.addItem(PRODUCT_A, 1);
      session.clear();
      TestBed.tick();
      session.markAuthenticated('CLIENTE', 'c@d.pe', 8);
      TestBed.tick();
      expect(service.isEmpty()).toBeTrue();
    });
  });

  describe('revalidate (GET /api/catalog/products?ids=)', () => {
    it('refreshes prices, flags unavailable lines and raises the prices-updated notice', () => {
      service.addItem(PRODUCT_A, 1);
      service.addItem(PRODUCT_B, 1);
      service.revalidate().subscribe();
      const http = TestBed.inject(HttpTestingController);
      const req = http.expectOne((r) => r.url === '/api/catalog/products');
      expect(req.request.params.getAll('ids')).toEqual(['1', '2']);
      // Only product 1 is still listed, with a new price (backend Page<ProductSummaryDto> shape).
      req.flush({
        content: [
          { id: 1, title: 'Llavero A', category: 'LLAVERO', subcategory: 'Personalizados', price: 21.5 },
        ],
        page: 0,
        size: 2,
        totalElements: 1,
        totalPages: 1,
      });
      expect(service.items().find((i) => i.productId === 1)?.unitPrice).toBe(21.5);
      expect(service.unavailableIds().has(2)).toBeTrue();
      expect(service.hasUnavailable()).toBeTrue();
      expect(service.pricesUpdated()).toBeTrue();
      http.verify();
    });

    it('does nothing (and makes no request) for an empty cart', () => {
      service.revalidate().subscribe();
      TestBed.inject(HttpTestingController).expectNone(() => true);
    });

    it('leaves the cart untouched when the request fails', () => {
      service.addItem(PRODUCT_A, 1);
      service.revalidate().subscribe();
      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url === '/api/catalog/products')
        .flush(
          { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
          { status: 500, statusText: 'x' },
        );
      expect(service.items().length).toBe(1);
      expect(service.hasUnavailable()).toBeFalse();
    });
  });
});
