import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SessionStateService } from '../../../core/services/session-state.service';
import {
  OtpRequestPayload,
  OtpRequestResponse,
  OtpVerifyPayload,
  OtpVerifyResponse,
} from '../models/otp.models';

/**
 * Thin HTTP client for the two OTP endpoints (`contracts/otp-auth-api.md`). No business rule —
 * validity, throttling, account creation, role assignment — is decided here; every response is
 * exactly what the backend returned, and this service's only added behavior is recording the
 * resulting client-side session flag (Prohibited Practice #5 / Constitution Principle III).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStateService);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth/otp`;

  /**
   * Requests a one-time code for the given email. The backend responds identically (202)
   * whether or not the account already exists (FR-004) — this method must never be extended to
   * infer or branch on account existence at this step; only `verifyOtp`'s response may do that
   * (FR-004a).
   */
  requestOtp(email: string): Observable<OtpRequestResponse> {
    const payload: OtpRequestPayload = { email };
    return this.http.post<OtpRequestResponse>(`${this.baseUrl}/request`, payload, {
      withCredentials: true,
    });
  }

  /**
   * Verifies a submitted code. On success the backend has already established the session via
   * `Set-Cookie` (httpOnly — not readable here); this method only records the local,
   * non-authoritative "we believe we're signed in" flag used by `authGuard` for routing UX.
   */
  verifyOtp(email: string, code: string): Observable<OtpVerifyResponse> {
    const payload: OtpVerifyPayload = { email, code };
    return this.http
      .post<OtpVerifyResponse>(`${this.baseUrl}/verify`, payload, { withCredentials: true })
      .pipe(tap(() => this.session.markAuthenticated('CLIENTE')));
  }
}
