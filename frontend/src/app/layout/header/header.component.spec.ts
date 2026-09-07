import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';
import { CartStateService } from '../../features/cart/services/cart-state.service';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../features/cart/services/cart-storage.adapter';
import { CartItem } from '../../features/cart/models/cart-item.model';
import { CatalogProduct } from '../../shared/models/catalog-product.model';
import { HeaderComponent } from './header.component';

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
  subcategory: 'Personalizados',
  title: 'Llavero',
  price: 10,
};

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let session: SessionStateService;
  let cart: CartStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    session = TestBed.inject(SessionStateService);
    cart = TestBed.inject(CartStateService);
    fixture.detectChanges();
  });

  it('renders the brand wordmark', () => {
    expect(fixture.nativeElement.textContent).toContain('AR MAKERS');
  });

  it('links to the real catalog route', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/catalog"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Catálogo');
  });

  it('links to the real OTP login route when signed out, not an invented one', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href="/auth/request-code"]',
    );
    expect(link).toBeTruthy();
  });

  it('switches to the account link once SessionStateService reports authenticated', () => {
    session.markAuthenticated();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/account"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/auth/request-code"]')).toBeNull();
  });

  it('shows a logout control once authenticated and clears the session on click', () => {
    session.markAuthenticated('CLIENTE', 'customer@example.com');
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const button = buttons.find((el) => el.textContent?.includes('Cerrar sesión'));
    expect(button).toBeTruthy();
    button!.click();

    expect(session.isAuthenticated()).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('does not show a logout control while signed out', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const button = buttons.find((el) => el.textContent?.includes('Cerrar sesión'));
    expect(button).toBeUndefined();
  });

  it('links to /cart and shows no badge when the cart is empty', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/cart"]');
    expect(link).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.app-header__cart-badge')).toBeNull();
  });

  it('reflects the live cart item count as items are added and removed', () => {
    cart.addItem(PRODUCT, 2);
    fixture.detectChanges();

    let badge = fixture.nativeElement.querySelector('.app-header__cart-badge');
    expect(badge.textContent.trim()).toBe('2');

    cart.removeItem('p1');
    fixture.detectChanges();

    badge = fixture.nativeElement.querySelector('.app-header__cart-badge');
    expect(badge).toBeNull();
  });

  it('shows "Panel de administración" instead of "Mi cuenta" for a staff session', () => {
    session.markAuthenticated('ASESOR', 'asesor.andrea@armakers3d.com');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/account"]')).toBeNull();
  });
});
