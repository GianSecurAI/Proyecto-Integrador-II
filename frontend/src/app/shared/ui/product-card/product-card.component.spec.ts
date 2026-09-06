import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../models/catalog-product.model';
import { ProductCardComponent } from './product-card.component';

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
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
});
