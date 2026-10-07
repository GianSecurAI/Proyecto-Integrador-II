import { Injectable, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { SessionStateService } from '../../../core/services/session-state.service';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CatalogService } from '../../catalog/services/catalog.service';
import { CART_QUANTITY_MAX, CART_QUANTITY_MIN, CartItem } from '../models/cart-item.model';
import { CART_STORAGE_ADAPTER, CartStorageError, GUEST_CART_SCOPE } from './cart-storage.adapter';

/**
 * `'ready'` once the cart has a known, usable item list (whether empty or populated). `'error'`
 * only for the real case where `CartStorageAdapter.load()` throws (storage blocked/corrupt).
 */
export type CartLoadStatus = 'ready' | 'error';

/** Backend limit on distinct lines in one order and on `ids` per catalog query. */
const REVALIDATE_MAX_IDS = 50;

/**
 * Single source of truth for the standard-catalog self-service shopping cart (CLAUDE.md's
 * "Business clarification: purchasing flows"; `docs/decisions/ADR-cart-state.md`). Plain signals,
 * `providedIn: 'root'`.
 *
 * ADR follow-ups implemented here:
 * - storage is keyed per session context (guest, or `user-<id>`); a guest cart is merged into the
 *   user's cart on sign-in; the signed-in user's cart is CLEARED (memory + storage) when the
 *   session ends (logout, or a 401 -> `SessionStateService.clear()`), so it cannot leak to the
 *   next user of a shared browser;
 * - `revalidate()` refreshes display prices from `GET /api/catalog/products?ids=` and flags
 *   lines that are no longer available;
 * - quantities are clamped to 1..99 (UX mirror of the backend limit);
 * - the cart is cleared by the checkout only AFTER the backend confirmed the order.
 *
 * PRICES/TOTALS ARE PRESENTATION-ONLY: `subtotal` is computed from client-held snapshots. The
 * server prices every order and the final amount comes from the order response.
 */
@Injectable({ providedIn: 'root' })
export class CartStateService {
  private readonly storage = inject(CART_STORAGE_ADAPTER);
  private readonly session = inject(SessionStateService);
  // Resolved lazily: only `revalidate()` needs HTTP, so merely adding to the cart (product cards,
  // header badge) never requires the HttpClient provider.
  private readonly injector = inject(Injector);

  private readonly itemsState = signal<readonly CartItem[]>([]);
  private readonly statusState = signal<CartLoadStatus>('ready');
  private readonly unavailableState = signal<ReadonlySet<number>>(new Set());
  private readonly priceNoticeState = signal(false);
  /** Whose cart is loaded: `null` = guest. */
  private activeUserId: number | null = null;

  readonly items = computed(() => this.itemsState());
  readonly status = computed(() => this.statusState());
  readonly isEmpty = computed(() => this.itemsState().length === 0);
  /** Total unit count across all lines (drives the header badge). */
  readonly itemCount = computed(() =>
    this.itemsState().reduce((total, item) => total + item.quantity, 0),
  );
  /** Presentation-only subtotal (see class comment). */
  readonly subtotal = computed(() =>
    round2(this.itemsState().reduce((total, item) => total + item.unitPrice * item.quantity, 0)),
  );
  /** Product ids the server reported as unknown/unavailable at the last `revalidate()`. */
  readonly unavailableIds = this.unavailableState.asReadonly();
  readonly hasUnavailable = computed(() => this.unavailableState().size > 0);
  /** True when the last `revalidate()` changed at least one displayed price. */
  readonly pricesUpdated = this.priceNoticeState.asReadonly();

  constructor() {
    this.loadFromStorage();
    effect(() => {
      const userId = this.session.currentUserId();
      untracked(() => this.switchScope(userId));
    });
  }

  /** Re-attempts loading from storage (e.g. after a transient failure). */
  retryLoad(): void {
    this.loadFromStorage();
  }

  /** Recovery path from the error state: continue with a fresh, empty in-memory cart. */
  continueWithEmptyCart(): void {
    this.itemsState.set([]);
    this.statusState.set('ready');
  }

  /**
   * Adds `quantity` (default 1) units; an existing line is incremented instead of duplicated
   * (one line per product id — the backend rejects duplicate products in an order). Quantity is
   * capped at 99 per line.
   */
  addItem(product: CatalogProduct, quantity = 1): void {
    const safeQuantity = clampQuantity(Math.trunc(quantity) || 1);
    this.itemsState.update((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: clampQuantity(item.quantity + safeQuantity) }
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

  /** Sets an absolute quantity for an existing line, clamped to 1..99. */
  setQuantity(productId: number, quantity: number): void {
    const safeQuantity = Number.isFinite(quantity) ? clampQuantity(Math.trunc(quantity)) : 1;
    this.itemsState.update((items) =>
      items.map((item) => (item.productId === productId ? { ...item, quantity: safeQuantity } : item)),
    );
    this.persist();
  }

  removeItem(productId: number): void {
    this.itemsState.update((items) => items.filter((item) => item.productId !== productId));
    this.unavailableState.update((ids) => new Set([...ids].filter((id) => id !== productId)));
    this.persist();
  }

  clearCart(): void {
    this.itemsState.set([]);
    this.unavailableState.set(new Set());
    this.priceNoticeState.set(false);
    this.storage.clear();
  }

  dismissPriceNotice(): void {
    this.priceNoticeState.set(false);
  }

  /**
   * Asks the backend for the CURRENT data of the carted products (`ids` filter): refreshes the
   * displayed price/title, flags lines the server no longer lists (unknown or unavailable) and
   * raises `pricesUpdated` when a price changed. Never errors — on failure the cart is left as
   * is (the order submission re-validates everything server-side anyway).
   */
  revalidate(): Observable<void> {
    const items = this.itemsState();
    if (items.length === 0) return of(undefined);
    const ids = items.slice(0, REVALIDATE_MAX_IDS).map((item) => item.productId);
    return this.injector.get(CatalogService).getByIds(ids).pipe(
      map((page) => {
        const current = new Map(page.content.map((product) => [product.id, product]));
        const unavailable = new Set<number>();
        let priceChanged = false;
        const refreshed = this.itemsState().map((item) => {
          if (!ids.includes(item.productId)) return item;
          const product = current.get(item.productId);
          if (!product) {
            unavailable.add(item.productId);
            return item;
          }
          if (product.price !== item.unitPrice) priceChanged = true;
          return {
            ...item,
            title: product.title,
            category: product.category,
            subcategory: product.subcategory,
            unitPrice: product.price,
          };
        });
        this.itemsState.set(refreshed);
        this.unavailableState.set(unavailable);
        if (priceChanged) this.priceNoticeState.set(true);
        this.persist();
      }),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Re-scopes storage when the signed-in account changes. Sign-in: load the user's cart and merge
   * the guest cart into it. Sign-out/401: forget the previous user's cart entirely.
   */
  private switchScope(userId: number | null): void {
    if (userId === this.activeUserId) return;
    const previous = this.activeUserId;
    this.activeUserId = userId;
    if (userId !== null) {
      const guestItems = previous === null ? this.itemsState() : [];
      this.storage.useScope?.(GUEST_CART_SCOPE);
      if (previous === null) this.storage.clear();
      this.storage.useScope?.(userScope(userId));
      this.loadFromStorage();
      for (const item of guestItems) {
        const existing = this.itemsState().find((line) => line.productId === item.productId);
        this.itemsState.update((items) =>
          existing
            ? items.map((line) =>
                line.productId === item.productId
                  ? { ...line, quantity: clampQuantity(line.quantity + item.quantity) }
                  : line,
              )
            : [...items, item],
        );
      }
      if (guestItems.length > 0) this.persist();
    } else {
      if (previous !== null) {
        this.storage.useScope?.(userScope(previous));
        this.storage.clear();
      }
      this.storage.useScope?.(GUEST_CART_SCOPE);
      this.itemsState.set([]);
      this.unavailableState.set(new Set());
      this.priceNoticeState.set(false);
      this.statusState.set('ready');
    }
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

function userScope(userId: number): string {
  return `user-${userId}`;
}

function clampQuantity(quantity: number): number {
  return Math.min(CART_QUANTITY_MAX, Math.max(CART_QUANTITY_MIN, quantity));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
