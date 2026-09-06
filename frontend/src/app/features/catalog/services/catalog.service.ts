import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { CatalogProduct } from '../../../shared/models/catalog-product.model';
import { CATALOG_PRODUCTS } from '../mocks/catalog-products.mock';

/**
 * Product data source for the Catalog page. RF-07/RF-08 (docs/discovery/05-figma-analysis.md
 * §1) is a confirmed requirement, but the real domain model and REST contract are still being
 * finalized (direct Product Owner instruction, this session) — so `getProducts()` is backed by
 * mock data today.
 *
 * The method signature (`Observable<CatalogProduct[]>`, no arguments — filtering happens client
 * side against the full loaded list, per the orchestrator brief) is exactly what a real
 * HTTP-backed implementation would keep: `return this.http.get<CatalogProduct[]>('/api/catalog/products')`.
 * `delay(500)` is a TEMPORARY stand-in for real network latency so the loading state
 * (`LoadingStateComponent`) is genuinely exercised during development/tests, not skipped — it
 * must be removed (not replaced by a `setTimeout`) once this calls the real backend.
 *
 * This mock implementation never actually errors (there's no network to fail), which is why the
 * error path is proven separately with a test double in `catalog.page.spec.ts` rather than here.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  getProducts(): Observable<CatalogProduct[]> {
    return of(CATALOG_PRODUCTS).pipe(delay(500));
  }
}
