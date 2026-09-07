import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, map, switchMap, tap, throwError, timer } from 'rxjs';

/** Temporary UI boundary; never an authorization source. */
export interface AuthPreview {
  hasPendingRequest(): boolean;
  // `email` is optional: the verify-code screen resends in place without ever storing the
  // address it was given at the request step (see VerifyCodePage.requestNewCode()).
  requestOtp(email?: string): Observable<void>;
  verifyOtp(code: string): Observable<void>;
  reset(): void;
}

export type AuthPreviewErrorReason = 'invalid' | 'expired' | 'unknown';

/**
 * Discriminated preview-only failure. `reason` exists purely so the UI can render distinct
 * demo copy for the two magic codes below — it is never derived from, or a substitute for,
 * real OTP validation, which does not exist yet. Never treat this as an authorization signal.
 */
export class AuthPreviewError extends Error {
  constructor(readonly reason: AuthPreviewErrorReason) {
    super(`Auth preview error: ${reason}`);
    this.name = 'AuthPreviewError';
  }
}

/**
 * TEMPORARY PREVIEW-ONLY MAGIC CODES.
 * These two reserved 6-digit values let a reviewer/QA preview the "expired" and "invalid"
 * error states from the UI alone (see #preview-instructions in verify-code.page.html) without
 * a real backend. They carry no security meaning whatsoever — a future integrator replacing
 * this mock with a real OTP round trip MUST delete this block entirely rather than adapt it;
 * do not mistake these constants for real OTP validity/expiry rules.
 */
export const MOCK_EXPIRED_OTP = '000000';
export const MOCK_INVALID_OTP = '111111';

@Injectable({ providedIn: 'root' })
export class AuthMockService implements AuthPreview {
  private readonly pending = signal(false);
  readonly hasPendingRequest = this.pending.asReadonly();

  // No email, OTP, account lookup, cookies, or credentials are retained.
  requestOtp(): Observable<void> {
    return timer(500).pipe(
      tap(() => this.pending.set(true)),
      map(() => undefined),
    );
  }

  // `code` only ever drives the two documented preview branches below; any other
  // well-formed 6-digit value continues to "succeed" exactly as before.
  verifyOtp(code: string): Observable<void> {
    if (!this.pending()) return throwError(() => new AuthPreviewError('unknown'));
    if (code === MOCK_EXPIRED_OTP) {
      return timer(500).pipe(switchMap(() => throwError(() => new AuthPreviewError('expired'))));
    }
    if (code === MOCK_INVALID_OTP) {
      return timer(500).pipe(switchMap(() => throwError(() => new AuthPreviewError('invalid'))));
    }
    return timer(500).pipe(
      tap(() => this.reset()),
      map(() => undefined),
    );
  }

  reset(): void {
    this.pending.set(false);
  }
}

export const AUTH_PREVIEW = new InjectionToken<AuthPreview>('AUTH_PREVIEW', {
  providedIn: 'root',
  factory: () => inject(AuthMockService),
});
