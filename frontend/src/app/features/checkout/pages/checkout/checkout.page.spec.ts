import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import {
  CART_STORAGE_ADAPTER,
  CartStorageAdapter,
} from '../../../cart/services/cart-storage.adapter';
import { CartItem } from '../../../cart/models/cart-item.model';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CheckoutPage } from './checkout.page';

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

/**
 * Integration-level coverage of the step wizard itself: forward/backward navigation and that
 * typed data (held centrally by `CheckoutStateService`, not by any one step component) survives
 * moving between steps in both directions.
 */
describe('CheckoutPage', () => {
  let fixture: ComponentFixture<CheckoutPage>;
  let cart: CartStateService;
  let checkoutState: CheckoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        { provide: CART_STORAGE_ADAPTER, useValue: new FakeCartStorageAdapter() },
      ],
    });
    cart = TestBed.inject(CartStateService);
    cart.addItem(PRODUCT, 1);
    checkoutState = TestBed.inject(CheckoutStateService);
    fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();
  });

  it('starts on the cart-review step', () => {
    expect(fixture.componentInstance.step()).toBe('cart');
  });

  it('advances through every step when each step emits "next"', () => {
    const component = fixture.componentInstance;
    component.goToStep('customer');
    expect(component.step()).toBe('customer');
    component.goToStep('delivery');
    expect(component.step()).toBe('delivery');
    component.goToStep('review');
    expect(component.step()).toBe('review');
  });

  it('preserves typed customer/delivery data across forward AND backward step navigation', () => {
    const component = fixture.componentInstance;
    checkoutState.setCustomerInfo({ fullName: 'Ana', email: 'ana@example.com', phone: '987654321' });
    checkoutState.setDeliveryInfo({ address: 'Calle 1', district: 'San Isidro', notes: '' });

    component.goToStep('customer');
    fixture.detectChanges();
    component.goToStep('cart');
    fixture.detectChanges();
    component.goToStep('customer');
    fixture.detectChanges();

    // Still held centrally — never lost by navigating back and forth.
    expect(checkoutState.customerInfo()?.fullName).toBe('Ana');
    expect(checkoutState.deliveryInfo()?.address).toBe('Calle 1');
  });
});
