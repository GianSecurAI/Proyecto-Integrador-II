import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { OrderKind, OrderStatus } from '../../../shared/models/wire-enums';
import {
  AdminOrderDetailDto,
  AdminOrderSummaryDto,
  AdminOrderSummaryViewModel,
  AdminOrderViewModel,
  RegisterPersonalizedOrderFormValue,
  toAdminOrderSummaryViewModel,
  toAdminOrderViewModel,
} from '../models/admin-order.model';

/** Query of `GET /api/admin/orders`. `from`/`to` are `YYYY-MM-DD` (inclusive, America/Lima). */
export interface AdminOrderQuery {
  q?: string;
  status?: OrderStatus | null;
  kind?: OrderKind | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  size?: number;
  sort?: string;
}

/** Result of registering a personalized order: `replayed` is true when the server recognised the
 * same Idempotency-Key + body and returned the original order (200 instead of 201). */
export interface RegisteredPersonalizedOrder {
  order: AdminOrderViewModel;
  replayed: boolean;
}

/**
 * Staff order management (ASESOR and ADMINISTRADOR): list/filter/detail, status change and
 * personalized-order registration. All authorization, validation and transition rules live in the
 * backend; the detail response carries `allowedNextStatuses`, which is exactly what the UI offers.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrdersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/orders`;

  list(query: AdminOrderQuery = {}): Observable<Page<AdminOrderSummaryViewModel>> {
    const params = buildParams({
      q: query.q?.trim(),
      status: query.status,
      kind: query.kind,
      from: query.from,
      to: query.to,
      sort: query.sort,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http.get<Page<AdminOrderSummaryDto>>(this.url, { params }).pipe(
      map((page) => ({ ...page, content: page.content.map(toAdminOrderSummaryViewModel) })),
    );
  }

  get(orderId: string): Observable<AdminOrderViewModel> {
    return this.http
      .get<AdminOrderDetailDto>(`${this.url}/${encodeURIComponent(orderId)}`)
      .pipe(map(toAdminOrderViewModel));
  }

  /** `PATCH /api/admin/orders/{id}/status`. Anything the lifecycle does not allow (including
   * re-sending the current status, or losing a race) is `409 INVALID_STATUS_TRANSITION`. */
  changeStatus(orderId: string, status: OrderStatus, note: string | null): Observable<AdminOrderViewModel> {
    const body: { status: OrderStatus; note?: string } = { status };
    const trimmed = note?.trim();
    if (trimmed) body.note = trimmed;
    return this.http
      .patch<AdminOrderDetailDto>(`${this.url}/${encodeURIComponent(orderId)}/status`, body)
      .pipe(map(toAdminOrderViewModel));
  }

  /**
   * `POST /api/admin/orders/personalized`: registers an order whose quotation and payment happened
   * OUTSIDE the system (CLAUDE.md custom flow). `agreedAmount` is the amount staff agreed with the
   * customer — nothing is calculated. `paymentConfirmed` must be true or the server answers 400.
   * An unknown email creates the customer account; a staff/deactivated account is
   * `409 CUSTOMER_NOT_ELIGIBLE`. `idempotencyKey` makes a retry safe.
   */
  registerPersonalized(
    value: RegisterPersonalizedOrderFormValue,
    idempotencyKey: string,
  ): Observable<RegisteredPersonalizedOrder> {
    const body = {
      customerEmail: value.customerEmail.trim(),
      description: value.description.trim(),
      agreedAmount: value.agreedAmount,
      paymentConfirmed: value.paymentConfirmed,
    };
    return this.http
      .post<AdminOrderDetailDto>(`${this.url}/personalized`, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          order: toAdminOrderViewModel(response.body as AdminOrderDetailDto),
          replayed: response.headers.get('Idempotent-Replayed') === 'true',
        })),
      );
  }
}
