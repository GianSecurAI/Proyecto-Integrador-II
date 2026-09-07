import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../../app.routes';
import { CartStateService } from '../../../cart/services/cart-state.service';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CartItem } from '../../../cart/models/cart-item.model';
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

describe('ProductDetailPage', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    }),
  );

  it('renders the gallery placeholder for every product (no real photo in any fixture)', async () => {
    // See mocks/product-details.mock.ts: no mock product has a real photo (an earlier version
    // pointed one fixture at a real downloaded photo of a third-party branded product, which was
    // removed). Thumbnail-switching itself is covered in isolation by
    // product-gallery.component.spec.ts with synthetic image fixtures.
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/catalog/llavero-diseno-naranja', ProductDetailPage);
    const element = harness.routeNativeElement!;
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.gallery__empty')?.textContent).toContain('Imagen no disponible');
  });

  it('adds to the real cart on "Añadir a la cesta" and shows confirmation feedback', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/catalog/llavero-diseno-naranja', ProductDetailPage);
    const element = harness.routeNativeElement!;
    const cart = TestBed.inject(CartStateService);

    const buttons = element.querySelectorAll<HTMLButtonElement>('.product-detail__actions button');
    expect(buttons[0].textContent).toContain('Comprar ahora S/ 19.90');
    expect(buttons[1].textContent).toContain('Añadir a la cesta');
    expect(element.querySelector('a[href*="wa.me"]')).toBeNull();

    buttons[1].click();
    harness.detectChanges();

    expect(cart.itemCount()).toBe(1);
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Se añadió al carrito.',
    );

    await harness.navigateByUrl('/catalog/llavero-1', ProductDetailPage);
    expect(harness.routeNativeElement!.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('"Comprar ahora" adds to the cart and navigates to /cart', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/catalog/llavero-diseno-naranja', ProductDetailPage);
    const element = harness.routeNativeElement!;
    const cart = TestBed.inject(CartStateService);

    const buttons = element.querySelectorAll<HTMLButtonElement>('.product-detail__actions button');
    buttons[0].click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(cart.itemCount()).toBe(1);
    expect(TestBed.inject(Router).url).toBe('/cart');
  });

  it('updates reused detail routes and shows an unknown-product state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/catalog/llavero-1', ProductDetailPage);
    expect(harness.routeNativeElement!.textContent).toContain('Llavero con silueta de mascota');
    await harness.navigateByUrl('/catalog/digital-1', ProductDetailPage);
    expect(harness.routeNativeElement!.textContent).toContain('Modelo 3D descargable');
    expect(harness.routeNativeElement!.querySelector('[data-testid="whatsapp-cta"]')).toBeNull();
    await harness.navigateByUrl('/catalog/no-existe', ProductDetailPage);
    expect(harness.routeNativeElement!.textContent).toContain('Producto no encontrado');
    expect(
      harness.routeNativeElement!.querySelector('app-empty-state a')?.getAttribute('href'),
    ).toBe('/catalog');
  });
});
