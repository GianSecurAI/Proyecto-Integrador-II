import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import {
  AdminQuotation,
  CreateQuotationRequest,
  QuotationStatus,
} from '../models/admin-quotation.model';

export interface AdminQuotationQuery {
  q?: string;
  status?: QuotationStatus | null;
  page?: number;
  size?: number;
}

/**
 * Staff quotation management (ASESOR and ADMINISTRADOR), RF-08/RF-09/RF-11: `GET/POST /api/admin/quotations`,
 * `GET /{id}`, `PATCH /{id}/status` and `POST /{id}/order`. The backend enforces the life cycle (REGISTRADA ->
 * ACEPTADA | RECHAZADA | VENCIDA) and that only an accepted quotation, with the external payment confirmed,
 * generates its single order.
 */
@Injectable({ providedIn: 'root' })
export class AdminQuotationsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/quotations`;

  list(query: AdminQuotationQuery = {}): Observable<Page<AdminQuotation>> {
    const params = buildParams({
      q: query.q?.trim(),
      status: query.status,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http.get<Page<AdminQuotation>>(this.url, { params });
  }

  get(id: number): Observable<AdminQuotation> {
    return this.http.get<AdminQuotation>(`${this.url}/${id}`);
  }

  create(request: CreateQuotationRequest): Observable<AdminQuotation> {
    return this.http.post<AdminQuotation>(this.url, request);
  }

  changeStatus(id: number, status: QuotationStatus, notes?: string): Observable<AdminQuotation> {
    return this.http.patch<AdminQuotation>(`${this.url}/${id}/status`, { status, notes });
  }

  generateOrder(id: number, paymentConfirmed: boolean): Observable<AdminQuotation> {
    return this.http.post<AdminQuotation>(`${this.url}/${id}/order`, { paymentConfirmed });
  }
}
