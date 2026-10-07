import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { OrderKind, OrderStatus } from '../../../shared/models/wire-enums';
import {
  OrderDetailViewModel,
  OrderResponseDto,
  OrderSummaryDto,
  OrderSummaryViewModel,
  toOrderDetailViewModel,
  toOrderSummaryViewModel,
} from '../models/order.model';

export interface CustomerOrderFilter {
  status?: OrderStatus | null;
  kind?: OrderKind | null;
  page?: number;
  size?: number;
}

/**
 * Owner-scoped read access to orders: `GET /api/orders` (list, own orders only) and
 * `GET /api/orders/{id}` (detail with `statusHistory`; an unknown id and another customer's id are
 * both 404). There is NO public tracking endpoint (decision D-07): every call needs the CLIENTE
 * session. Whatever the query says, the server only returns the caller's own orders.
 */
@Injectable({ providedIn: 'root' })
export class CustomerOrdersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/orders`;

  /** The customer's orders, newest first (server default sort), one server page. */
  list(filter: CustomerOrderFilter = {}): Observable<Page<OrderSummaryViewModel>> {
    const params = buildParams({
      status: filter.status,
      kind: filter.kind,
      page: filter.page ?? 0,
      size: filter.size ?? 20,
    });
    return this.http
      .get<Page<OrderSummaryDto>>(this.url, { params })
      .pipe(map((page) => ({ ...page, content: page.content.map(toOrderSummaryViewModel) })));
  }

  get(orderId: string): Observable<OrderDetailViewModel> {
    return this.http
      .get<OrderResponseDto>(`${this.url}/${encodeURIComponent(orderId)}`)
      .pipe(map(toOrderDetailViewModel));
  }
}
