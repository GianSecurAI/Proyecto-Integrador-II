import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { ProductShowcaseComponent } from './product-showcase.component';

const PRODUCTS: CatalogProduct[] = [
  { id: 'p1', category: 'Llaveros', subcategory: 'Llaveros', title: 'Producto 1', price: 10 },
  { id: 'p2', category: 'Llaveros', subcategory: 'Llaveros', title: 'Producto 2', price: 12 },
];

describe('ProductShowcaseComponent', () => {
  let fixture: ComponentFixture<ProductShowcaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductShowcaseComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductShowcaseComponent);
    fixture.componentRef.setInput('heading', 'Tendencias');
    fixture.componentRef.setInput('headingAccent', 'actuales');
    fixture.componentRef.setInput('subheading', 'Subheading de prueba');
    fixture.componentRef.setInput('products', PRODUCTS);
    fixture.componentRef.setInput('ctaLabel', 'Ver todos los productos');
    fixture.detectChanges();
  });

  it('renders one product card per product', () => {
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(2);
  });

  it('links the bottom CTA to the real /catalog route, not a disabled placeholder', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[routerLink], a[href="/catalog"]',
    );
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Ver todos los productos');
  });
});
