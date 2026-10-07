import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
  CartStorageError,
} from '../../services/cart-storage.adapter';
import { CartStateService } from '../../services/cart-state.service';
import { CartItem } from '../../models/cart-item.model';
import { CartPage } from './cart.page';

const PRODUCT: CatalogProduct = {
  id: 1,
  category: 'LLAVERO',
  subcategory: 'Personalizados',
  title: 'Llavero A',
  price: 19.9,
};

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

describe('CartPage', () => {
  let fixture: ComponentFixture<CartPage>;
  let cart: CartStateService;
  let fakeAdapter: FakeCartStorageAdapter;

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [provideRouter([]), { provide: CART_STORAGE_ADAPTER, useValue: fakeAdapter }],
    });
    fixture = TestBed.createComponent(CartPage);
    cart = TestBed.inject(CartStateService);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fakeAdapter = new FakeCartStorageAdapter();
  });

  it('renders the empty-cart state when the cart has zero items', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío');
  });

  it('renders cart items, subtotal and total (no separate shipping amount) when populated', () => {
    setup();
    cart.addItem(PRODUCT, 2);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('S/ 39.80'); // subtotal and total both equal this
    expect(text).not.toContain('Se calcula');
    expect(text).not.toContain('Envío');
    expect(text).not.toContain('FREE');
    expect(text).not.toContain('SSL');
  });

  it('links "Proceder al checkout" to the real /checkout route', () => {
    setup();
    cart.addItem(PRODUCT, 1);
    fixture.detectChanges();

    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    const checkoutLink = links.find((el) => el.textContent?.includes('Proceder al checkout'))!;
    expect(checkoutLink.getAttribute('routerLink')).toBe('/checkout');
  });

  it('removing the last item returns to the empty-cart state', () => {
    setup();
    cart.addItem(PRODUCT, 1);
    fixture.detectChanges();
    cart.removeItem(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío');
  });

  it('shows the error state and recovers via "continue with an empty cart"', () => {
    fakeAdapter.loadError = new CartStorageError('boom');
    setup();

    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar tu carrito');

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const continueButton = buttons.find((el) =>
      el.textContent?.includes('Continuar con un carrito vacío'),
    )!;
    continueButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío');
  });
});
