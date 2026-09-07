import { Injectable, InjectionToken, inject } from '@angular/core';
import { CartItem } from '../models/cart-item.model';

/**
 * Small persistence boundary so `CartStateService` (and every component that uses it) NEVER
 * touches `localStorage` directly — only this adapter does. Swappable by design: the interface
 * is the seam a future real cart/order backend would replace this whole class through, without
 * any consumer of `CartStateService` needing to change.
 *
 * TEMPORARY / PROVISIONAL — no backend cart persistence exists yet. This MUST be REPLACED (not
 * extended) once a real cart/order endpoint exists, mirroring the "temporary, isolated mock"
 * disclaimer used throughout this codebase (e.g. `customer-orders.mock.ts`,
 * `admin-products-mock.service.ts`).
 *
 * IMPORTANT — this is NOT the same rule as `SessionStateService`'s "no fake session
 * restoration" disclaimer, and a future reader should not conflate the two: that rule exists
 * because caching an auth/session flag in `localStorage` would mean the frontend *trusting* a
 * client-readable value for an AUTHORIZATION decision (Constitution Principle III), which is
 * unsafe regardless of UX convenience. A shopping cart's contents (product ids + quantities) are
 * not a security-sensitive credential — persisting them across a reload is ordinary,
 * non-authoritative UI-preference-shaped state, the same class of thing real browsers routinely
 * persist for a cart. Nothing here is ever treated as authoritative pricing or as proof of
 * anything (see `CartItem`'s doc comment) — it is just "what did the visitor put in their cart",
 * which is safe and expected to survive a reload.
 */
export interface CartStorageAdapter {
  load(): readonly CartItem[];
  save(items: readonly CartItem[]): void;
  clear(): void;
}

/**
 * DI seam for `CartStorageAdapter`. `CartStateService` injects THIS token, never the concrete
 * `LocalStorageCartStorageAdapter` class directly, so specs (and a future real implementation)
 * can override the provider without touching `CartStateService` itself.
 */
export const CART_STORAGE_ADAPTER = new InjectionToken<CartStorageAdapter>('CART_STORAGE_ADAPTER', {
  providedIn: 'root',
  factory: () => inject(LocalStorageCartStorageAdapter),
});

const STORAGE_KEY = 'ar-makers-3d.cart.v1';

/**
 * Default `localStorage`-backed implementation. Reading/writing `localStorage` can throw (e.g. a
 * private-browsing context that blocks storage access, or a full/disabled storage quota) — every
 * method here catches that and degrades gracefully (`load()` returns an empty cart,
 * `save()`/`clear()` become silent no-ops) rather than letting a storage failure crash the cart
 * feature. `CartStateService` surfaces the "could not load" case via the shared error-state
 * component instead of silently pretending nothing happened.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageCartStorageAdapter implements CartStorageAdapter {
  load(): readonly CartItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCartItem);
    } catch {
      // Storage inaccessible (private browsing, quota, corrupted JSON) or malformed contents —
      // surfaced by the caller as a real "cart could not be loaded" state, never logged (cart
      // contents are not logged anywhere in this codebase, same discipline as every other
      // feature here).
      throw new CartStorageError('Cart storage is inaccessible or contains invalid data');
    }
  }

  save(items: readonly CartItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Best-effort persistence only — a save failure must never break the in-memory cart the
      // customer is actively using.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Same best-effort reasoning as save() above.
    }
  }
}

/** Thrown by `LocalStorageCartStorageAdapter.load()` so `CartStateService` can distinguish a
 * real storage failure from "cart is legitimately empty" — mirrors `AdminProductsMockError`/
 * `OrdersMockError`'s dedicated-error-type convention elsewhere in this codebase. */
export class CartStorageError extends Error {}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['productId'] === 'string' &&
    typeof candidate['title'] === 'string' &&
    typeof candidate['category'] === 'string' &&
    typeof candidate['subcategory'] === 'string' &&
    typeof candidate['unitPrice'] === 'number' &&
    typeof candidate['quantity'] === 'number' &&
    candidate['quantity'] >= 1
  );
}
