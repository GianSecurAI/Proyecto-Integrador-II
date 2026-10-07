import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../../app.routes';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { ProductDetailPage } from './product-detail.page';

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

/** Shape copied from backend `ProductDetailDto`. */
const DETAIL = {
  id: 5,
  title: 'Llavero naranja',
  category: 'LLAVERO',
  subcategory: 'Llaveros personalizados',
  price: 19.9,
  description: 'Un llavero impreso en 3D.',
  characteristics: ['PLA', 'Resistente'],
  images: [],
};

describe('ProductDetailPage (real catalog service)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  /** Navigates (component created, request issued) WITHOUT waiting for the HTTP response. */
  async function open(id: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/catalog/${id}`, ProductDetailPage);
    return { harness, nav: Promise.resolve() };
  }

  it('loads /api/catalog/products/{id}, renders real fields and the empty-gallery placeholder', async () => {
    const { harness, nav } = await open('5');
    http.expectOne('/api/catalog/products/5').flush(DETAIL);
    await nav;
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.textContent).toContain('Llavero naranja');
    expect(element.textContent).toContain('Llavero / Llaveros personalizados');
    expect(element.textContent).toContain('S/ 19.90');
    expect(element.textContent).toContain('Resistente');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.gallery__empty')?.textContent).toContain('Imagen no disponible');
    expect(element.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it('adds to the cart on "Añadir a la cesta" and shows feedback', async () => {
    const { harness, nav } = await open('5');
    http.expectOne('/api/catalog/products/5').flush(DETAIL);
    await nav;
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    const cart = TestBed.inject(CartStateService);
    const buttons = element.querySelectorAll<HTMLButtonElement>('.product-detail__actions button');
    expect(buttons[0].textContent).toContain('Comprar ahora S/ 19.90');
    buttons[1].click();
    harness.detectChanges();
    expect(cart.itemCount()).toBe(1);
    expect(cart.items()[0].productId).toBe(5);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Se añadió al carrito.');
  });

  it('"Comprar ahora" adds to the cart and navigates to /cart', async () => {
    const { harness, nav } = await open('5');
    http.expectOne('/api/catalog/products/5').flush(DETAIL);
    await nav;
    harness.detectChanges();
    const buttons = harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>(
      '.product-detail__actions button',
    );
    buttons[0].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(CartStateService).itemCount()).toBe(1);
    expect(TestBed.inject(Router).url).toBe('/cart');
    // Opening the cart revalidates it against the catalog (ADR-cart-state follow-up 4).
    http
      .expectOne((r) => r.url === '/api/catalog/products' && r.params.getAll('ids')?.[0] === '5')
      .flush({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 });
  });

  it('shows the not-found state on 404 (unknown or unavailable product)', async () => {
    const { harness, nav } = await open('999');
    http
      .expectOne('/api/catalog/products/999')
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    await nav;
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.textContent).toContain('Producto no encontrado');
    expect(element.querySelector('app-empty-state a')?.getAttribute('href')).toBe('/catalog');
  });

  it('treats a non-numeric id as not found without calling the API', async () => {
    const { harness, nav } = await open('llavero-diseno-naranja');
    await nav;
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Producto no encontrado');
    http.expectNone((r) => r.url.startsWith('/api/catalog/products'));
  });

  it('shows a retryable error state on a server failure', async () => {
    const { harness, nav } = await open('5');
    http
      .expectOne('/api/catalog/products/5')
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    await nav;
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('app-error-state')).toBeTruthy();
  });
});
