import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaymentMethod } from '../../../shared/models/wire-enums';
import { CartItem } from '../../cart/models/cart-item.model';
import { CheckoutDto, CreateCheckoutRequest } from '../models/checkout.model';
import { CustomerInfoFormValue, DeliveryInfoFormValue } from '../models/checkout-form.model';

/**
 * Explicit mapping from the cart + checkout forms to the wire request. Written field by field so
 * `unitPrice`/`title`/anything else on `CartItem` structurally cannot leak into the request
 * (ADR-cart-state follow-up 6; Principle III). Blank optional notes are omitted.
 */
export function buildCheckoutRequest(
  items: readonly CartItem[],
  customer: CustomerInfoFormValue,
  delivery: DeliveryInfoFormValue,
): CreateCheckoutRequest {
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
 * Customer side of the manual Yape/Plin payment flow (ADR-005, FE-04). Typed access to
 * `/api/checkout`; every decision (price, state, who may do what) is the backend's. The session
 * cookie is sent by `credentialsInterceptor` and requested explicitly on the proof calls too.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/checkout`;

  /** `POST /api/checkout` — 201, or 200 + `Idempotent-Replayed` when the key was already used. */
  create(request: CreateCheckoutRequest, idempotencyKey: string): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(this.url, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  get(checkoutId: string): Observable<CheckoutDto> {
    return this.http.get<CheckoutDto>(this.path(checkoutId));
  }

  cancel(checkoutId: string): Observable<CheckoutDto> {
    return this.http.post<CheckoutDto>(`${this.path(checkoutId)}/cancel`, null);
  }

  /**
   * `POST /api/checkout/{id}/proof` as `multipart/form-data`. `Content-Type` is deliberately NOT
   * set so the browser adds the multipart boundary. The server re-validates type (by bytes),
   * size, method and code; the checks done before calling this are UX only.
   */
  uploadProof(
    checkoutId: string,
    file: File,
    method: PaymentMethod,
    operationCode: string | null,
  ): Observable<CheckoutDto> {
    const form = new FormData();
    form.append('file', file);
    form.append('method', method);
    const code = operationCode?.trim();
    if (code) form.append('operationCode', code);
    return this.http.post<CheckoutDto>(`${this.path(checkoutId)}/proof`, form, {
      withCredentials: true,
    });
  }

  /** Own proof image as a Blob (the caller creates and revokes the object URL). */
  proofImage(checkoutId: string, attemptId: string): Observable<Blob> {
    return this.http.get(`${this.path(checkoutId)}/proof/${encodeURIComponent(attemptId)}`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  private path(checkoutId: string): string {
    return `${this.url}/${encodeURIComponent(checkoutId)}`;
  }
}
