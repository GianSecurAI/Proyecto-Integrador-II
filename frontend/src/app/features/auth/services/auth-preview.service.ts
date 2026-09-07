import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, map, switchMap, tap, throwError, timer } from 'rxjs';
import { AppRole } from '../../../core/auth/roles';
import { resolveMockRole } from '../../../core/auth/mock-staff-directory';

/** What a successful `verifyOtp` resolves to: the role a real backend would have assigned this
 * account, plus the email the session should be marked with. Role is resolved from the
 * (mock) account directory ONLY after "verification" succeeds — a real login never lets the
 * visitor pick their own role up-front, so this shape deliberately mirrors that: the caller
 * cannot ask for a role, it can only find out what role verification produced. */
export interface VerifyOtpResult {
  readonly role: AppRole;
  readonly email: string;
}

/** Temporary UI boundary; never an authorization source. */
export interface AuthPreview {
  hasPendingRequest(): boolean;
  // `email` is optional: a resend (`VerifyCodePage.requestNewCode()`) re-triggers the preview
  // request without re-supplying it — see `AuthMockService.requestOtp` for how the previously
  // submitted address is retained internally across a resend.
  requestOtp(email?: string): Observable<void>;
  verifyOtp(code: string): Observable<VerifyOtpResult>;
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
  // Retains ONLY the most recently submitted email, in memory, purely so `verifyOtp` can resolve
  // a role from it (mirroring how a real backend ties a pending OTP challenge to the email it was
  // issued for) and so an in-place resend (`requestOtp()` called with no argument) keeps working
  // against the same address. Never written to `localStorage`/`sessionStorage`, never logged;
  // cleared by `reset()`, which runs after every completed/cancelled verify-code visit (see
  // `VerifyCodePage`'s `destroyRef.onDestroy`) and at the start of every fresh request/register
  // page visit.
  private readonly pendingEmail = signal<string | null>(null);

  requestOtp(email?: string): Observable<void> {
    return timer(500).pipe(
      tap(() => {
        this.pending.set(true);
        if (email) this.pendingEmail.set(email);
      }),
      map(() => undefined),
    );
  }

  // `code` only ever drives the two documented preview branches below; any other
  // well-formed 6-digit value continues to "succeed" exactly as before, now additionally
  // resolving a role for the submitted email via the shared mock directory (unknown/ordinary
  // customer emails default to CLIENTE, preserving FR-005's existing behavior).
  verifyOtp(code: string): Observable<VerifyOtpResult> {
    if (!this.pending()) return throwError(() => new AuthPreviewError('unknown'));
    if (code === MOCK_EXPIRED_OTP) {
      return timer(500).pipe(switchMap(() => throwError(() => new AuthPreviewError('expired'))));
    }
    if (code === MOCK_INVALID_OTP) {
      return timer(500).pipe(switchMap(() => throwError(() => new AuthPreviewError('invalid'))));
    }
    const email = this.pendingEmail() ?? '';
    const role = resolveMockRole(email);
    return timer(500).pipe(
      tap(() => this.reset()),
      map(() => ({ role, email })),
    );
  }

  reset(): void {
    this.pending.set(false);
    this.pendingEmail.set(null);
  }
}

export const AUTH_PREVIEW = new InjectionToken<AuthPreview>('AUTH_PREVIEW', {
  providedIn: 'root',
  factory: () => inject(AuthMockService),
});
