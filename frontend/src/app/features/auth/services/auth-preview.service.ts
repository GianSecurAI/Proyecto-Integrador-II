import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, map, tap, throwError, timer } from 'rxjs';

/** Temporary UI boundary; never an authorization source. */
export interface AuthPreview {
  hasPendingRequest(): boolean;
  requestOtp(email: string): Observable<void>;
  verifyOtp(code: string): Observable<void>;
  reset(): void;
}

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

  verifyOtp(): Observable<void> {
    if (!this.pending()) return throwError(() => new Error('No pending preview'));
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
