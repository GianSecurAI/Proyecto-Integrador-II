import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { CheckoutStatus } from '../../../shared/models/wire-enums';
import { PaymentDetailDto, PaymentSummaryDto } from '../models/admin-payment.model';

export interface AdminPaymentQuery {
  status?: CheckoutStatus;
  page?: number;
  size?: number;
}

/**
 * Administrator-only payment verification (FE-11, ADR-005): `/api/admin/payments`. The queue is
 * ordered by the server (oldest proof first). Approving creates the order on the SERVER; the SPA
 * only sends the decision. ASESOR gets 403 from the API regardless of what the UI shows.
 */
@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/payments`;

  /** `status` defaults to `PROOF_SUBMITTED` on the server too; it is sent explicitly. */
  list(query: AdminPaymentQuery = {}): Observable<Page<PaymentSummaryDto>> {
    const params = buildParams({
      status: query.status ?? 'PROOF_SUBMITTED',
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http.get<Page<PaymentSummaryDto>>(this.url, { params });
  }

  get(checkoutId: string): Observable<PaymentDetailDto> {
    return this.http.get<PaymentDetailDto>(this.path(checkoutId));
  }

  /** Proof screenshot as a Blob (the viewer creates and revokes the object URL). */
  proofImage(checkoutId: string, attemptId: string): Observable<Blob> {
    return this.http.get(`${this.path(checkoutId)}/proof/${encodeURIComponent(attemptId)}`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  /** `POST .../approve` (no body). Idempotent on the server; any other state is 409
   * `CHECKOUT_STATE_CONFLICT`. */
  approve(checkoutId: string): Observable<PaymentDetailDto> {
    return this.http.post<PaymentDetailDto>(`${this.path(checkoutId)}/approve`, null);
  }

  /** `POST .../reject` with `{ reason }` (server: trimmed, 1..300, no control characters). */
  reject(checkoutId: string, reason: string): Observable<PaymentDetailDto> {
    return this.http.post<PaymentDetailDto>(`${this.path(checkoutId)}/reject`, {
      reason: reason.trim(),
    });
  }

  private path(checkoutId: string): string {
    return `${this.url}/${encodeURIComponent(checkoutId)}`;
  }
}
