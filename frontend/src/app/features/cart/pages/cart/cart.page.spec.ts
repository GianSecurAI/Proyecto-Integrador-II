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
  id: 'p-a',
  category: 'Llaveros',
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
    expect(text).toContain('Se calcula en el checkout');
    expect(text).not.toContain('FREE');
    expect(text).not.toContain('SSL');
  });

  it('shows a demo-only checkout message without navigating anywhere real', () => {
    setup();
    cart.addItem(PRODUCT, 1);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const checkoutButton = buttons.find((el) => el.textContent?.includes('Proceder al checkout'))!;
    checkoutButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'El checkout todavía no está disponible',
    );
  });

  it('removing the last item returns to the empty-cart state', () => {
    setup();
    cart.addItem(PRODUCT, 1);
    fixture.detectChanges();
    cart.removeItem('p-a');
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
