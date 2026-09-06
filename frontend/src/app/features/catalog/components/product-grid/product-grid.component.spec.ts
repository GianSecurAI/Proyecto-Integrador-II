import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { ProductGridComponent } from './product-grid.component';

const PRODUCTS: CatalogProduct[] = [
  { id: 'p1', category: 'llavero', subcategory: 'Llaveros', title: 'Producto 1', price: 10 },
  { id: 'p2', category: 'llavero', subcategory: 'Llaveros', title: 'Producto 2', price: 12 },
];

describe('ProductGridComponent', () => {
  let fixture: ComponentFixture<ProductGridComponent>;

  async function setup(status: 'loading' | 'loaded' | 'error', products: CatalogProduct[] = []) {
    await TestBed.configureTestingModule({
      imports: [ProductGridComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductGridComponent);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('products', products);
    fixture.detectChanges();
  }

  it('renders the loading state while status is "loading"', async () => {
    await setup('loading');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-product-card')).toBeNull();
  });

  it('renders one product card per product when loaded with results', async () => {
    await setup('loaded', PRODUCTS);
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(2);
  });

  it('renders the empty state when loaded with zero results', async () => {
    await setup('loaded', []);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-product-card')).toBeNull();
  });

  it('renders the error state and emits retry when the retry action is clicked', async () => {
    await setup('error');
    const errorState = fixture.nativeElement.querySelector('[role="alert"]');
    expect(errorState).toBeTruthy();

    let retryCount = 0;
    fixture.componentInstance.retry.subscribe(() => retryCount++);

    const retryButton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    retryButton.click();

    expect(retryCount).toBe(1);
  });
});
