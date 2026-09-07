import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CartReviewStepComponent } from './cart-review-step.component';

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

describe('CartReviewStepComponent', () => {
  let fixture: ComponentFixture<CartReviewStepComponent>;
  let cart: CartStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CartReviewStepComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    });
    fixture = TestBed.createComponent(CartReviewStepComponent);
    cart = TestBed.inject(CartStateService);
  });

  it('shows the empty-cart state and no "Continuar" action when the cart has zero items', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío');
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    expect(buttons.some((b) => b.textContent?.includes('Continuar'))).toBe(false);
  });

  it('renders cart items and emits "next" only when the cart is non-empty', () => {
    cart.addItem(PRODUCT, 2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Llavero A');

    let nextEmitted = false;
    fixture.componentInstance.next.subscribe(() => (nextEmitted = true));
    fixture.componentInstance.goNext();
    expect(nextEmitted).toBe(true);
  });

  it('never emits "next" when called while the cart is empty (defensive, even though no button is rendered)', () => {
    fixture.detectChanges();
    let nextEmitted = false;
    fixture.componentInstance.next.subscribe(() => (nextEmitted = true));
    fixture.componentInstance.goNext();
    expect(nextEmitted).toBe(false);
  });

  it('falls back to the empty-cart state if every item is removed while this step is showing', () => {
    cart.addItem(PRODUCT, 1);
    fixture.detectChanges();
    cart.removeItem('p-a');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tu carrito está vacío');
  });
});
