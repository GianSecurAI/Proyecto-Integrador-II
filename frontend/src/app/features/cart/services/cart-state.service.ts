import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CartItem } from '../models/cart-item.model';
import { CART_STORAGE_ADAPTER, CartStorageError } from '../services/cart-storage.adapter';

/**
 * `'ready'` once the cart has a known, usable item list (whether empty or populated). `'error'`
 * only for the real (not simulated) case where `CartStorageAdapter.load()` throws — see that
 * adapter's doc comment. There is no `'loading'` status: reading `localStorage` is genuinely
 * synchronous, so there is no async gap to represent (unlike the `timer(...)`-based mock
 * services elsewhere in this codebase, which simulate a future real network call).
 */
export type CartLoadStatus = 'ready' | 'error';

/**
 * Single source of truth for the standard-catalog self-service shopping cart (CLAUDE.md's
 * "Business clarification: purchasing flows" — this cart never applies to the advisor-mediated
 * WhatsApp custom-order flow). Plain Angular signals, `providedIn: 'root'` — no NgRx, mirroring
 * every other stateful service in this codebase (`SessionStateService`,
 * `AdminProductsMockService`, etc.).
 *
 * This is the ONE place cart state lives: the cart page, the header's item-count badge, and the
 * catalog/product-detail "add to cart" actions all read from or call methods on this service —
 * no component holds its own copy of cart contents or re-derives the subtotal.
 *
 * PRICING/TOTALS ARE PRESENTATION-ONLY (Constitution Principle III): `subtotal`/`itemCount` below
 * are computed entirely from client-held, price-at-add-time snapshots (see `CartItem`'s doc
 * comment) — never treat them as an authoritative order total. A real checkout must always
 * re-request pricing from the backend rather than trusting anything this service reports.
 */
@Injectable({ providedIn: 'root' })
export class CartStateService {
  private readonly storage = inject(CART_STORAGE_ADAPTER);

  private readonly itemsState = signal<readonly CartItem[]>([]);
  private readonly statusState = signal<CartLoadStatus>('ready');

  readonly items = computed(() => this.itemsState());
  readonly status = computed(() => this.statusState());
  readonly isEmpty = computed(() => this.itemsState().length === 0);
  /** Total unit count across all lines (e.g. 2 lines of quantity 3 and 1 -> 4), driving the
   * header badge. NOT the number of distinct lines. */
  readonly itemCount = computed(() =>
    this.itemsState().reduce((total, item) => total + item.quantity, 0),
  );
  /** Presentation-only subtotal — see class doc comment. Sum of `unitPrice * quantity` across
   * every line, rounded to 2 decimals to avoid floating-point noise (e.g. 0.1 + 0.2). */
  readonly subtotal = computed(() =>
    round2(this.itemsState().reduce((total, item) => total + item.unitPrice * item.quantity, 0)),
  );

  constructor() {
    this.loadFromStorage();
  }

  /** Re-attempts loading from storage (e.g. after a transient failure). */
  retryLoad(): void {
    this.loadFromStorage();
  }

  /** Recovery path from the error state: proceeds with a fresh, empty in-memory cart rather than
   * blocking the customer indefinitely because storage is unavailable (e.g. private browsing). */
  continueWithEmptyCart(): void {
    this.itemsState.set([]);
    this.statusState.set('ready');
  }

  /**
   * Adds `quantity` (default 1) units of `product` to the cart. If a line for this product
   * already exists, its quantity is increased instead of creating a duplicate row — the cart
   * always has at most one line per product id.
   */
  addItem(product: CatalogProduct, quantity = 1): void {
    const safeQuantity = Math.max(1, Math.trunc(quantity) || 1);
    this.itemsState.update((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + safeQuantity }
            : item,
        );
      }
      const newItem: CartItem = {
        productId: product.id,
        title: product.title,
        category: product.category,
        subcategory: product.subcategory,
        unitPrice: product.price,
        quantity: safeQuantity,
      };
      return [...items, newItem];
    });
    this.persist();
  }

  /**
   * Sets an EXPLICIT absolute quantity for an existing line (used by the cart page's +/-
   * stepper). Non-finite/non-positive values are clamped to 1 rather than accepted as-is — the
   * stepper's decrement is also disabled at quantity 1 in the UI, so this clamp is a defensive
   * backstop, not the only guard.
   */
  setQuantity(productId: string, quantity: number): void {
    const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
    this.itemsState.update((items) =>
      items.map((item) => (item.productId === productId ? { ...item, quantity: safeQuantity } : item)),
    );
    this.persist();
  }

  removeItem(productId: string): void {
    this.itemsState.update((items) => items.filter((item) => item.productId !== productId));
    this.persist();
  }

  clearCart(): void {
    this.itemsState.set([]);
    this.storage.clear();
  }

  private loadFromStorage(): void {
    try {
      this.itemsState.set(this.storage.load());
      this.statusState.set('ready');
    } catch (error) {
      if (error instanceof CartStorageError) {
        this.itemsState.set([]);
        this.statusState.set('error');
        return;
      }
      throw error;
    }
  }

  private persist(): void {
    this.storage.save(this.itemsState());
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
