import { TestBed } from '@angular/core/testing';
import { CartItem } from '../models/cart-item.model';
import { CartStorageError, LocalStorageCartStorageAdapter } from './cart-storage.adapter';

const ITEMS: readonly CartItem[] = [
  {
    productId: 'p-a',
    title: 'Llavero A',
    category: 'Llaveros',
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

  it('treats malformed stored JSON as a load failure rather than throwing an unhandled error', () => {
    localStorage.setItem('ar-makers-3d.cart.v1', 'not-json{{{');
    expect(() => adapter.load()).toThrowError(CartStorageError);
  });
});
