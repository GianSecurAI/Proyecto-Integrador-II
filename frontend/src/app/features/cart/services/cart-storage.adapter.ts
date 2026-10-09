import { Injectable, InjectionToken, inject } from '@angular/core';
import { PRODUCT_CATEGORIES, ProductCategory } from '../../../shared/models/wire-enums';
import { CART_QUANTITY_MAX, CART_QUANTITY_MIN, CartItem } from '../models/cart-item.model';

/**
 * Small persistence boundary so `CartStateService` NEVER touches `localStorage` directly — only
 * this adapter does (ADR-cart-state: the DI token stays the single seam in case a backend cart is
 * ever approved).
 *
 * The cart is NOT a security-sensitive credential (product ids + quantities), unlike a session
 * flag, so persisting it across reloads is fine; but it is client-editable and therefore treated
 * as UNTRUSTED on load (`isCartItem` range-checks everything) and never as authoritative pricing.
 *
 * `useScope` keys storage per session context (`guest` or `user-<id>`) so one user's cart never
 * leaks to the next user of a shared browser (ADR follow-up 1).
 */
export interface CartStorageAdapter {
  load(): readonly CartItem[];
  save(items: readonly CartItem[]): void;
  clear(): void;
  /** Optional: switches the storage key to another scope (fakes may omit it). */
  useScope?(scope: string): void;
}

export const CART_STORAGE_ADAPTER = new InjectionToken<CartStorageAdapter>('CART_STORAGE_ADAPTER', {
  providedIn: 'root',
  factory: () => inject(LocalStorageCartStorageAdapter),
});

/** v2: numeric product ids + per-scope keys. The v1 key (string ids) is discarded on load. */
const KEY_PREFIX = 'ar-makers-3d.cart.v2.';
const LEGACY_KEY = 'ar-makers-3d.cart.v1';
export const GUEST_CART_SCOPE = 'guest';

/**
 * Default `localStorage`-backed implementation. Storage access can throw (private browsing,
 * quota, disabled): `save`/`clear` degrade to silent no-ops, `load` throws a typed
 * `CartStorageError` so the cart page can show a real "could not load" state.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageCartStorageAdapter implements CartStorageAdapter {
  private scope = GUEST_CART_SCOPE;

  useScope(scope: string): void {
    this.scope = scope;
  }

  private get key(): string {
    return KEY_PREFIX + this.scope;
  }

  load(): readonly CartItem[] {
    try {
      localStorage.removeItem(LEGACY_KEY); // v1 content (string ids) is obsolete — discard.
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCartItem);
    } catch {
      throw new CartStorageError('Cart storage is inaccessible or contains invalid data');
    }
  }

  save(items: readonly CartItem[]): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(items));
    } catch {
      // Best-effort persistence only.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Best-effort.
    }
  }
}

export class CartStorageError extends Error {}

/** Stored contents are untrusted: integer ids, integer quantity within 1..99, finite price. */
function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    Number.isInteger(c['productId']) &&
    (c['productId'] as number) > 0 &&
    typeof c['title'] === 'string' &&
    PRODUCT_CATEGORIES.includes(c['category'] as ProductCategory) &&
    typeof c['subcategory'] === 'string' &&
    typeof c['unitPrice'] === 'number' &&
    Number.isFinite(c['unitPrice']) &&
    (c['unitPrice'] as number) >= 0 &&
    Number.isInteger(c['quantity']) &&
    (c['quantity'] as number) >= CART_QUANTITY_MIN &&
    (c['quantity'] as number) <= CART_QUANTITY_MAX
  );
}
