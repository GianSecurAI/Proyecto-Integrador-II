import { TestBed } from '@angular/core/testing';
import { CartItem } from '../models/cart-item.model';
import { CartStorageError, LocalStorageCartStorageAdapter } from './cart-storage.adapter';

const ITEMS: readonly CartItem[] = [
  {
    productId: 1,
    title: 'Llavero A',
    category: 'LLAVERO',
    subcategory: 'Personalizados',
    unitPrice: 19.9,
    quantity: 2,
  },
];

describe('LocalStorageCartStorageAdapter', () => {
  let adapter: LocalStorageCartStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = TestBed.inject(LocalStorageCartStorageAdapter);
  });

  afterEach(() => localStorage.clear());

  it('round-trips: save then load reconstructs the same cart', () => {
    adapter.save(ITEMS);
    const loaded = adapter.load();
    expect(loaded).toEqual(ITEMS);
  });

  it('returns an empty cart when nothing was ever saved', () => {
    expect(adapter.load()).toEqual([]);
  });

  it('clear() removes previously saved contents', () => {
    adapter.save(ITEMS);
    adapter.clear();
    expect(adapter.load()).toEqual([]);
  });

  it('degrades gracefully (throws a typed CartStorageError) when storage access throws', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('storage inaccessible');
    expect(() => adapter.load()).toThrowError(CartStorageError);
  });

  it('degrades gracefully (silent no-op) when a save fails', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('storage inaccessible');
    expect(() => adapter.save(ITEMS)).not.toThrow();
  });

  it('keys storage per scope so carts never leak between users', () => {
    adapter.useScope('user-1');
    adapter.save(ITEMS);
    adapter.useScope('user-2');
    expect(adapter.load()).toEqual([]);
    adapter.useScope('user-1');
    expect(adapter.load()).toEqual(ITEMS);
  });

  it('discards obsolete v1 content (string ids) instead of loading it', () => {
    localStorage.setItem('ar-makers-3d.cart.v1', JSON.stringify([{ productId: 'p-a' }]));
    expect(adapter.load()).toEqual([]);
    expect(localStorage.getItem('ar-makers-3d.cart.v1')).toBeNull();
  });

  it('treats stored contents as untrusted: drops non-integer ids and out-of-range quantities', () => {
    const base = { title: 't', category: 'LLAVERO', subcategory: 's', unitPrice: 1 };
    localStorage.setItem(
      'ar-makers-3d.cart.v2.guest',
      JSON.stringify([
        { ...base, productId: 1, quantity: 2 },
        { ...base, productId: 'x', quantity: 2 },
        { ...base, productId: 1.5, quantity: 2 },
        { ...base, productId: 3, quantity: 100 },
        { ...base, productId: 4, quantity: 0 },
        { ...base, productId: 5, quantity: 1, unitPrice: -1 },
      ]),
    );
    expect(adapter.load().map((i) => i.productId)).toEqual([1]);
  });

  it('treats malformed stored JSON as a load failure rather than throwing an unhandled error', () => {
    localStorage.setItem('ar-makers-3d.cart.v2.guest', 'not-json{{{');
    expect(() => adapter.load()).toThrowError(CartStorageError);
  });
});
