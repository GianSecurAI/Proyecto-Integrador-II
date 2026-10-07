import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { ProductCategory } from '../../../shared/models/wire-enums';
import {
  AdminProductDto,
  AdminProductViewModel,
  ProductFormValue,
  toAdminProductViewModel,
  toProductWriteRequest,
} from '../models/admin-product.model';

export interface AdminProductQuery {
  q?: string;
  category?: ProductCategory | null;
  available?: boolean | null;
  page?: number;
  size?: number;
  /** `price|title|createdAt[,asc|desc]`. */
  sort?: string;
}

/**
 * ADMINISTRADOR-only catalog administration (`/api/admin/products`): list (including unavailable
 * products), detail, create (201), full update (PUT) and the availability toggle (PATCH). All
 * validation is re-done by the server (`400 VALIDATION_FAILED` + `fieldErrors`).
 */
@Injectable({ providedIn: 'root' })
export class AdminProductsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/products`;

  list(query: AdminProductQuery = {}): Observable<Page<AdminProductViewModel>> {
    const params = buildParams({
      q: query.q?.trim(),
      category: query.category,
      available: query.available,
      sort: query.sort,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http
      .get<Page<AdminProductDto>>(this.url, { params })
      .pipe(map((page) => ({ ...page, content: page.content.map(toAdminProductViewModel) })));
  }

  get(id: number): Observable<AdminProductViewModel> {
    return this.http.get<AdminProductDto>(`${this.url}/${id}`).pipe(map(toAdminProductViewModel));
  }

  create(value: ProductFormValue): Observable<AdminProductViewModel> {
    return this.http
      .post<AdminProductDto>(this.url, toProductWriteRequest(value))
      .pipe(map(toAdminProductViewModel));
  }

  update(id: number, value: ProductFormValue): Observable<AdminProductViewModel> {
    return this.http
      .put<AdminProductDto>(`${this.url}/${id}`, toProductWriteRequest(value))
      .pipe(map(toAdminProductViewModel));
  }

  setAvailability(id: number, available: boolean): Observable<AdminProductViewModel> {
    return this.http
      .patch<AdminProductDto>(`${this.url}/${id}/availability`, { available })
      .pipe(map(toAdminProductViewModel));
  }
}
