import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStateService } from '../services/session-state.service';

/**
 * Single global HTTP error interceptor (Constitution Principle IX): every feature reuses this
 * instead of inventing its own 401/403/network-error handling.
 *
 * T011 (foundational): the interceptor shell + pass-through of every error so callers can still
 * render their own inline messages.
 * T053 (US4): the actual 401 → redirect-to-sign-in and 403 → forbidden-view wiring.
 *
 * Non-obvious "why" #1 — the OTP endpoints are deliberately exempted from the global 401
 * redirect: `POST /api/auth/otp/verify` legitimately returns 401 as a *business* rejection
 * ("the code you typed is wrong" — FR-007), not as "your session is invalid." If this
 * interceptor treated that 401 the same as a protected-resource 401, it would yank the user
 * away from the "enter code" page exactly when they mistype a digit, instead of letting that
 * page show an inline "incorrect code" message (see verify-code.page.ts, US2/T038). The same
 * applies to 400/410/429 on both OTP endpoints — those are documented, expected outcomes of
 * `contracts/otp-auth-api.md` that the two auth pages are responsible for surfacing themselves.
 *
 * Non-obvious "why" #2 — every other endpoint's 401 means "no valid session" (per the contract's
 * "Session-scoped requests" section) and 403 means "wrong role or another customer's resource";
 * those are exactly the session/authorization outcomes this shared interceptor exists to handle
 * once, instead of every future feature re-implementing the same redirect.
 */
const OTP_ENDPOINT_PATTERN = /\/auth\/otp\/(request|verify)$/;

function isOtpEndpoint(url: string): boolean {
  return OTP_ENDPOINT_PATTERN.test(url);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionStateService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const isExpectedOtpFlowError =
          isOtpEndpoint(req.url) && [400, 401, 410, 429].includes(error.status);

        if (!isExpectedOtpFlowError) {
          if (error.status === 401) {
            // No valid session (or it just expired/was invalidated) — the guard's local flag
            // was optimistic; the backend's verdict is authoritative, so correct it here too.
            session.clear();
            router.navigate(['/auth/request-code']);
          } else if (error.status === 403) {
            router.navigate(['/forbidden']);
          } else if (error.status === 0 || error.status >= 500) {
            router.navigate(['/unexpected-error']);
          }
        }
      }

      return throwError(() => error);
    }),
  );
};
