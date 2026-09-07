import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../cart/services/cart-storage.adapter';
import { CartItem } from '../../cart/models/cart-item.model';
import { CartStateService } from '../../cart/services/cart-state.service';
import { checkoutCartNotEmptyGuard } from './checkout-cart-not-empty.guard';

const PRODUCT: CatalogProduct = {
  id: 'p-a',
  category: 'Llaveros',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

class FakeCartStorageAdapter implements CartStorageAdapter {
  private saved: readonly CartItem[] = [];
  load(): readonly CartItem[] {
    return this.saved;
  }
  save(items: readonly CartItem[]): void {
    this.saved = items;
  }
  clear(): void {
    this.saved = [];
  }
}

describe('checkoutCartNotEmptyGuard', () => {
  let cart: CartStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    });
    cart = TestBed.inject(CartStateService);
    router = TestBed.inject(Router);
  });

  it('redirects to /cart when the cart is empty', () => {
    const result = TestBed.runInInjectionContext(() => checkoutCartNotEmptyGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/cart');
  });

  it('allows navigation when the cart has items', () => {
    cart.addItem(PRODUCT, 1);
    const result = TestBed.runInInjectionContext(() => checkoutCartNotEmptyGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('is registered as the guard for the /checkout route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    expect(router.url).toBe('/cart');
  });
});
