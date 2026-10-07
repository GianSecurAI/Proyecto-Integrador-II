import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { CatalogProduct, ProductDetail } from '../../../shared/models/catalog-product.model';
import { CatalogFilters } from '../models/catalog-filters.model';

/** Page size used by the storefront grid. */
export const CATALOG_PAGE_SIZE = 12;

/**
 * Public catalog client (`/api/catalog/products`). Filtering, searching, sorting and paging are
 * performed by the backend; this service only translates UI filter state into query params.
 * Only AVAILABLE products are ever returned by the server (an unavailable product is a 404).
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/catalog/products`;

  list(
    filters: Partial<CatalogFilters> = {},
    page = 0,
    size = CATALOG_PAGE_SIZE,
  ): Observable<Page<CatalogProduct>> {
    const params = buildParams({
      q: filters.query?.trim(),
      category: filters.category && filters.category !== 'todo' ? filters.category : null,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: filters.sort,
      page,
      size,
    });
    return this.http.get<Page<CatalogProduct>>(this.url, { params });
  }

  get(id: number): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.url}/${id}`);
  }

  /** Current server data for specific products (`ids` filter, max 50) — used to revalidate a
   * cart. Unknown/unavailable ids are simply absent from the result. */
  getByIds(ids: readonly number[]): Observable<Page<CatalogProduct>> {
    return this.http.get<Page<CatalogProduct>>(this.url, {
      params: buildParams({ ids: [...ids], size: Math.max(1, Math.min(ids.length, 50)) }),
    });
  }

  /** Newest products first (home showcase). */
  latest(size = 4): Observable<Page<CatalogProduct>> {
    return this.list({ sort: 'createdAt,desc' }, 0, size);
  }
}
