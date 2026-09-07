import { Injectable, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { ADMIN_PRODUCTS_EMPTY, ADMIN_PRODUCTS_SEED, AdminProductSeed } from '../mocks/admin-products.mock';
import { AdminProductViewModel, ProductFormValue } from '../models/admin-product.model';

/**
 * Deterministic preview states, driven by the `?mockState=` route query param — same convention
 * already established by `OrdersMockState`/`IncidentsMockState`
 * (`features/account/services/customer-orders-mock.service.ts`,
 * `.../customer-incidents-mock.service.ts`). `'populated'` is the default (real, seeded mock
 * data); `'empty'` and `'error'` exist purely so a reviewer can preview those UI states from the
 * browser URL bar alone, without a real backend to force them.
 */
export type AdminProductsMockState = 'populated' | 'empty' | 'error';

/**
 * Thrown by this mock service instead of a generic `Error`, so callers (and their specs) can
 * distinguish a deliberate mock failure/not-found from an unrelated bug — mirrors
 * `OrdersMockError`/`IncidentsMockError`.
 */
export class AdminProductsMockError extends Error {}

/**
 * TEMPORARY PREVIEW-ONLY MAGIC VALUE.
 * Including this exact marker anywhere in a submitted title lets a reviewer/QA preview the
 * "create/update failed" error state from the UI alone, without a real backend. It carries no
 * security or validation meaning whatsoever — a future integrator replacing this mock with a real
 * admin product endpoint MUST delete this block entirely rather than adapt it. Mirrors
 * `MOCK_SUBMIT_FAILURE_MARKER` in `customer-incidents-mock.service.ts` /
 * `MOCK_SAVE_FAILURE_PHONE` in `customer-profile-mock.service.ts`.
 */
export const MOCK_PRODUCT_SAVE_FAILURE_MARKER = '__mock_fail__';

function toViewModel(seed: AdminProductSeed): AdminProductViewModel {
  return {
    id: seed.id,
    category: seed.category,
    subcategory: seed.subcategory,
    title: seed.title,
    price: seed.price,
    compareAtPrice: seed.compareAtPrice,
    badge: seed.badge,
    personalizable: seed.personalizable,
    description: seed.description,
    available: seed.available,
    characteristics: seed.characteristics,
  };
}

/** Splits the form's raw multi-line textarea value into a trimmed, non-empty characteristic list
 * — the one, deliberately minimal "repeatable field" implementation named in this feature's own
 * scope (a plain textarea split on newlines), kept here rather than in the form model itself so
 * `ProductFormValue` stays a plain form-submission shape. */
function splitCharacteristics(raw: string): readonly string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

let nextMockProductSequence = 1;

/**
 * Isolated, frontend-only preview service for the RF-07 admin product-management screens
 * (list/detail/create). No REST contract is defined for admin catalog management yet — Figma has
 * zero admin frames of any kind (confirmed absent, see `pages/product-list/admin-product-list.page.ts`'s
 * doc comment) and the `Producto` entity is only sketched at a high level
 * (`docs/discovery/06-system-definition.md` lines 197-201). Holds the seeded mock products as a
 * signal (mirroring `CustomerOrdersMockService`) and simulates network latency via `timer(...)` on
 * every method. Never touches `localStorage`/`sessionStorage`, never logs any product data.
 *
 * `getProductById`'s "not found" case is a REAL state (not simulated by `mockState`) — reachable
 * by navigating to any id absent from the seed — same convention already used by
 * `CustomerOrdersMockService.getOrderById`/`ProductDetailPage`'s "Producto no encontrado" state.
 *
 * `setAvailability` is a separate method from `updateProduct` on purpose: the product-list page's
 * confirm-dialog-gated "deactivate" action calls it directly, without going through the full
 * edit form (see `AdminConfirmDialogComponent`'s one concrete trigger).
 */
@Injectable({ providedIn: 'root' })
export class AdminProductsMockService {
  private readonly products = signal<readonly AdminProductViewModel[]>(
    ADMIN_PRODUCTS_SEED.map(toViewModel),
  );

  getProducts(mockState: AdminProductsMockState = 'populated'): Observable<AdminProductViewModel[]> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminProductsMockError('Mock admin product list fetch failure')),
        ),
      );
    }
    if (mockState === 'empty') {
      return timer(400).pipe(map(() => [...ADMIN_PRODUCTS_EMPTY.map(toViewModel)]));
    }
    // Fresh, mutable array (not the internal readonly signal value) — mirrors
    // `CustomerOrdersMockService.getOrders()`'s exposure convention.
    return timer(400).pipe(map(() => [...this.products()]));
  }

  getProductById(
    id: string,
    mockState: AdminProductsMockState = 'populated',
  ): Observable<AdminProductViewModel> {
    if (mockState === 'error') {
      return timer(400).pipe(
        switchMap(() =>
          throwError(() => new AdminProductsMockError('Mock admin product detail fetch failure')),
        ),
      );
    }
    return timer(400).pipe(
      switchMap(() => {
        const found = this.products().find((product) => product.id === id);
        return found
          ? of(found)
          : throwError(() => new AdminProductsMockError(`Mock admin product "${id}" not found`));
      }),
    );
  }

  createProduct(value: ProductFormValue): Observable<AdminProductViewModel> {
    if (value.title.includes(MOCK_PRODUCT_SAVE_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() =>
          throwError(() => new AdminProductsMockError('Mock admin product create failure')),
        ),
      );
    }
    const created: AdminProductViewModel = {
      id: `adm-mock-${nextMockProductSequence++}`,
      category: value.category,
      subcategory: value.subcategory.trim(),
      title: value.title.trim(),
      price: value.price,
      compareAtPrice: value.compareAtPrice ?? undefined,
      personalizable: value.personalizable,
      description: value.description.trim(),
      // A brand-new product is created active by default — there is no "create as inactive"
      // control in this form (see `admin-product.model.ts`'s doc comment on `available`).
      available: true,
      characteristics: splitCharacteristics(value.characteristics),
    };
    return timer(500).pipe(
      map(() => {
        this.products.update((current) => [created, ...current]);
        return created;
      }),
    );
  }

  updateProduct(id: string, value: ProductFormValue): Observable<AdminProductViewModel> {
    if (value.title.includes(MOCK_PRODUCT_SAVE_FAILURE_MARKER)) {
      return timer(500).pipe(
        switchMap(() =>
          throwError(() => new AdminProductsMockError('Mock admin product update failure')),
        ),
      );
    }
    return timer(500).pipe(
      switchMap(() => {
        const existing = this.products().find((product) => product.id === id);
        if (!existing) {
          return throwError(() => new AdminProductsMockError(`Mock admin product "${id}" not found`));
        }
        const updated: AdminProductViewModel = {
          ...existing,
          category: value.category,
          subcategory: value.subcategory.trim(),
          title: value.title.trim(),
          price: value.price,
          compareAtPrice: value.compareAtPrice ?? undefined,
          personalizable: value.personalizable,
          description: value.description.trim(),
          characteristics: splitCharacteristics(value.characteristics),
        };
        this.products.update((current) =>
          current.map((product) => (product.id === id ? updated : product)),
        );
        return of(updated);
      }),
    );
  }

  setAvailability(id: string, available: boolean): Observable<AdminProductViewModel> {
    return timer(400).pipe(
      switchMap(() => {
        const existing = this.products().find((product) => product.id === id);
        if (!existing) {
          return throwError(() => new AdminProductsMockError(`Mock admin product "${id}" not found`));
        }
        const updated: AdminProductViewModel = { ...existing, available };
        this.products.update((current) =>
          current.map((product) => (product.id === id ? updated : product)),
        );
        return of(updated);
      }),
    );
  }
}
