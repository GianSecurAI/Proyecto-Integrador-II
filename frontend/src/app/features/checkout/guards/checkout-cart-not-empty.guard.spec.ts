import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
import { SessionStateService } from '../../../core/services/session-state.service';
import { checkoutCartNotEmptyGuard } from './checkout-cart-not-empty.guard';

const PRODUCT: CatalogProduct = {
  id: 1,
  category: 'LLAVERO',
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
        provideHttpClient(),
        provideHttpClientTesting(),
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

  it('is registered as the guard for the /checkout route (signed-in CLIENTE with an empty cart)', async () => {
    TestBed.inject(SessionStateService).markAuthenticated('CLIENTE', 'a@b.pe', 1);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    expect(router.url).toBe('/cart');
  });

  it('sends a guest to the OTP login with a returnUrl (the backend only accepts orders from a CLIENTE)', async () => {
    cart.addItem(PRODUCT, 1);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    expect(router.url).toContain('/auth/request-code');
    expect(router.url).toContain('returnUrl=');
  });

  it('forbids a staff session from checkout', async () => {
    TestBed.inject(SessionStateService).markAuthenticated('ASESOR', 's@b.pe', 2);
    cart.addItem(PRODUCT, 1);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/checkout');
    expect(router.url).toBe('/forbidden');
  });
});
