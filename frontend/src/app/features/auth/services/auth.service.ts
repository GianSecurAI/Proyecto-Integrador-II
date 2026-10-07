import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AppRole } from '../../../core/auth/roles';
import { SessionStateService } from '../../../core/services/session-state.service';
import {
  MeResponse,
  OtpProfileFields,
  OtpRequestPayload,
  OtpRequestResponse,
  OtpVerifyPayload,
  OtpVerifyResponse,
} from '../models/otp.models';

/** What a successful verification resolves to; role/email/id all come from the server. */
export interface VerifyOtpResult {
  readonly role: AppRole;
  readonly email: string;
  readonly accountStatus: 'created' | 'existing';
}

/**
 * Real HTTP auth client: OTP request/verify, session restore (`GET /api/auth/me`) and logout.
 * No business rule is decided here (validity, throttling, account creation, role assignment are
 * the backend's); the service only remembers the email of the in-progress OTP challenge across
 * the request-code -> verify-code screens (in memory only, never logged or persisted) and mirrors
 * the server-reported identity into `SessionStateService`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStateService);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly pending = signal(false);
  private pendingEmail: string | null = null;
  readonly hasPendingRequest = this.pending.asReadonly();

  /**
   * Requests a one-time code. The backend answers 202 identically whether or not the account
   * exists (anti-enumeration) — never branch on existence here. `email` may be omitted for a
   * resend, reusing the address of the pending challenge.
   */
  requestOtp(email?: string, profile: OtpProfileFields = {}): Observable<void> {
    const target = (email ?? this.pendingEmail ?? '').trim();
    if (!target) return throwError(() => new Error('No email to request a code for'));
    const payload: OtpRequestPayload = { email: target };
    for (const key of ['firstName', 'lastName', 'phone'] as const) {
      const value = profile[key]?.trim();
      if (value) payload[key] = value;
    }
    return this.http.post<OtpRequestResponse>(`${this.baseUrl}/otp/request`, payload).pipe(
      tap(() => {
        this.pendingEmail = target;
        this.pending.set(true);
      }),
      map(() => undefined),
    );
  }

  /**
   * Verifies a code for the pending email. On success the backend has set the httpOnly session
   * cookie and the 200 body carries the identity (id, email, role), which marks the client session
   * directly (no extra `/auth/me` call; `/auth/me` stays for reload restore).
   */
  verifyOtp(code: string): Observable<VerifyOtpResult> {
    if (!this.pendingEmail) return throwError(() => new Error('No pending OTP request'));
    const payload: OtpVerifyPayload = { email: this.pendingEmail, code };
    return this.http.post<OtpVerifyResponse>(`${this.baseUrl}/otp/verify`, payload).pipe(
      tap((verified) => this.session.markAuthenticated(verified.role, verified.email, verified.id)),
      map((verified) => ({
        role: verified.role,
        email: verified.email,
        accountStatus: verified.accountStatus,
      })),
      tap(() => this.reset()),
    );
  }

  /** Forgets the in-progress challenge (not the session). */
  reset(): void {
    this.pending.set(false);
    this.pendingEmail = null;
  }

  /**
   * App-start session restore. Never errors: any failure (401 = signed out, network down) simply
   * leaves the visitor anonymous.
   */
  restoreSession(): Observable<void> {
    return this.http.get<MeResponse>(`${this.baseUrl}/me`).pipe(
      tap((me) => this.session.markAuthenticated(me.role, me.email, me.id)),
      map(() => undefined),
      catchError(() => {
        this.session.clear();
        return of(undefined);
      }),
    );
  }

  /** Revokes the server session (idempotent 204) and always clears local state, even if the
   * request itself fails. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null).pipe(
      catchError(() => of(undefined)),
      tap(() => this.session.clear()),
      map(() => undefined),
    );
  }
}
