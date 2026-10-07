import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OrderDetailViewModel, OrderResponseDto, toOrderDetailViewModel } from '../../account/models/order.model';
import { CartItem } from '../../cart/models/cart-item.model';
import { CustomerInfoFormValue, DeliveryInfoFormValue } from '../models/checkout-form.model';

/** Backend `PlaceOrderRequestDto` — the ONLY fields the client may send. There is deliberately no
 * price, total, status or customer-id field: the server prices and owns the order. */
export interface PlaceOrderRequest {
  items: { productId: number; quantity: number }[];
  delivery: { address: string; district: string; notes?: string };
  contact: { fullName: string; phone: string };
}

/**
 * Explicit mapping from the cart + checkout forms to the wire request. Written field by field so
 * `unitPrice`/`title`/anything else on `CartItem` structurally cannot leak into the request
 * (ADR-cart-state follow-up 6; Principle III). Blank optional notes are omitted.
 */
export function buildPlaceOrderRequest(
  items: readonly CartItem[],
  customer: CustomerInfoFormValue,
  delivery: DeliveryInfoFormValue,
): PlaceOrderRequest {
  const notes = delivery.notes.trim();
  return {
    items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    delivery: {
      address: delivery.address.trim(),
      district: delivery.district.trim(),
      ...(notes ? { notes } : {}),
    },
    contact: { fullName: customer.fullName.trim(), phone: customer.phone.trim() },
  };
}

/**
 * `POST /api/orders` — standard-catalog order submission (CLIENTE session required; note there is
 * NO payment step, PD-ORD-01). Sends an `Idempotency-Key` UUID per checkout attempt so a retry
 * after a lost response replays the original order (200 + `Idempotent-Replayed: true`) instead of
 * creating a duplicate; a fresh creation is 201. The confirmation shown to the customer is built
 * from the response (server price, status, items).
 */
@Injectable({ providedIn: 'root' })
export class StandardOrdersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/orders`;

  place(request: PlaceOrderRequest, idempotencyKey: string): Observable<OrderDetailViewModel> {
    return this.http
      .post<OrderResponseDto>(this.url, request, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(map(toOrderDetailViewModel));
  }
}
