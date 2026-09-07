import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CartItem } from '../../models/cart-item.model';
import { CartItemComponent } from './cart-item.component';

const ITEM: CartItem = {
  productId: 'p-a',
  title: 'Llavero A',
  category: 'Llaveros',
  subcategory: 'Personalizados',
  unitPrice: 19.9,
  quantity: 2,
};

describe('CartItemComponent', () => {
  let fixture: ComponentFixture<CartItemComponent>;

  function setItem(item: CartItem): void {
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CartItemComponent] }).compileComponents();
    fixture = TestBed.createComponent(CartItemComponent);
    setItem(ITEM);
  });

  it('renders title, category/subcategory and unit price', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero A');
    expect(text).toContain('Llaveros / Personalizados');
    expect(text).toContain('S/ 19.90');
  });

  it('renders the line subtotal as unitPrice * quantity', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('S/ 39.80');
  });

  it('renders an aria-hidden placeholder instead of a real product image', () => {
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    const placeholder = fixture.nativeElement.querySelector('.cart-item__image');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
  });

  it('disables the decrement button at quantity 1', () => {
    setItem({ ...ITEM, quantity: 1 });
    const decrementButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Disminuir cantidad"]',
    );
    expect(decrementButton.disabled).toBeTrue();
  });

  it('emits quantityChange with quantity + 1 on increment', () => {
    const emitted: { productId: string; quantity: number }[] = [];
    fixture.componentInstance.quantityChange.subscribe((value) => emitted.push(value));

    const incrementButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Aumentar cantidad"]',
    );
    incrementButton.click();

    expect(emitted).toEqual([{ productId: 'p-a', quantity: 3 }]);
  });

  it('emits quantityChange with quantity - 1 on decrement when above 1', () => {
    const emitted: { productId: string; quantity: number }[] = [];
    fixture.componentInstance.quantityChange.subscribe((value) => emitted.push(value));

    const decrementButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Disminuir cantidad"]',
    );
    decrementButton.click();

    expect(emitted).toEqual([{ productId: 'p-a', quantity: 1 }]);
  });

  it('does not emit quantityChange when decrementing at quantity 1', () => {
    setItem({ ...ITEM, quantity: 1 });
    const emitted: unknown[] = [];
    fixture.componentInstance.quantityChange.subscribe((value) => emitted.push(value));

    const decrementButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Disminuir cantidad"]',
    );
    decrementButton.click();

    expect(emitted.length).toBe(0);
  });

  it('emits remove with the product id', () => {
    const emitted: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => emitted.push(id));

    const removeButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.cart-item__remove',
    );
    removeButton.click();

    expect(emitted).toEqual(['p-a']);
  });
});
