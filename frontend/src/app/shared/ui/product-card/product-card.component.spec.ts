import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../features/cart/services/cart-storage.adapter';
import { CartStateService } from '../../../features/cart/services/cart-state.service';
import { CartItem } from '../../../features/cart/models/cart-item.model';
import { CatalogProduct } from '../../models/catalog-product.model';
import { ProductCardComponent } from './product-card.component';

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

const PRODUCT: CatalogProduct = {
  id: 'p1',
  category: 'Llaveros',
  subcategory: 'Llaveros personalizados',
  title: 'Llavero personalizado con placa 3D',
  price: 19.9,
  compareAtPrice: 25,
};

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  let fakeAdapter: FakeCartStorageAdapter;

  beforeEach(async () => {
    fakeAdapter = new FakeCartStorageAdapter();
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: fakeAdapter },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.detectChanges();
  });

  it('renders the product title and category/subcategory eyebrow', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero personalizado con placa 3D');
    expect(text).toContain('Llaveros / Llaveros personalizados');
  });

  it('formats the current and compare-at price in soles', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('S/ 19.90');
    expect(text).toContain('S/ 25.00');
  });

  it('renders an aria-hidden placeholder instead of a real product image', () => {
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    const placeholder = fixture.nativeElement.querySelector('.product-card__image');
    expect(placeholder).toBeTruthy();
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
  });

  it('links Ver más to this product detail without opening WhatsApp', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.textContent?.trim()).toBe('Ver más');
    expect(link.getAttribute('href')).toBe('/catalog/p1');
    expect(link.getAttribute('aria-label')).toContain(PRODUCT.title);
  });

  it('has no per-card "Personalizar" action alongside the standard add-to-cart button', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Personalizar');
    expect(fixture.nativeElement.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it('adds the product to the shared cart when "Añadir al carrito" is clicked', () => {
    const cart = TestBed.inject(CartStateService);
    expect(cart.itemCount()).toBe(0);

    const addButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Añadir Llavero personalizado con placa 3D al carrito"]',
    );
    addButton.click();
    fixture.detectChanges();

    expect(cart.itemCount()).toBe(1);
    expect(cart.items()[0].productId).toBe('p1');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Añadido al carrito',
    );
  });
});
