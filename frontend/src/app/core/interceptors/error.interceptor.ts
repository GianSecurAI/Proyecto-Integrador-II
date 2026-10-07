import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
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
/**
 * Opt-in (FE-02): a request carrying `new HttpContext().set(NAVIGATE_ON_ERROR, true)` is sent to
 * `/unexpected-error` on a network failure (status 0) or 5xx. By default nothing navigates, so
 * list/detail pages keep their inline "Reintentar" state. 401 and 403 handling is unconditional.
 */
export const NAVIGATE_ON_ERROR = new HttpContextToken<boolean>(() => false);

const OTP_ENDPOINT_PATTERN = /\/auth\/otp\/(request|verify)$/;
/** `GET /api/auth/me` is the app-start session probe and a post-login read-back: a 401 there just
 * means "anonymous", handled by `AuthService`, never a redirect. `POST /api/auth/logout` is
 * likewise handled by its caller. */
const SESSION_PROBE_PATTERN = /\/auth\/(me|logout)$/;

function isOtpEndpoint(url: string): boolean {
  return OTP_ENDPOINT_PATTERN.test(url);
}

function isSessionProbe(url: string): boolean {
  return SESSION_PROBE_PATTERN.test(url.split('?')[0]);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionStateService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // 403 on the OTP endpoints is ACCOUNT_DEACTIVATED (a business outcome the auth page shows
        // inline), not "wrong role".
        const isExpectedOtpFlowError =
          isOtpEndpoint(req.url) && [400, 401, 403, 410, 429].includes(error.status);

        if (!isExpectedOtpFlowError && !isSessionProbe(req.url)) {
          if (error.status === 401) {
            // No valid session (or it just expired/was invalidated) — the guard's local flag
            // was optimistic; the backend's verdict is authoritative, so correct it here too.
            // `session.clear()` also empties the per-user cart (see `CartStateService`).
            session.clear();
            router.navigate(['/auth/request-code']);
          } else if (error.status === 403) {
            router.navigate(['/forbidden']);
          } else if (
            req.context.get(NAVIGATE_ON_ERROR) &&
            (error.status === 0 || error.status >= 500)
          ) {
            router.navigate(['/unexpected-error']);
          }
        }
      }

      return throwError(() => error);
    }),
  );
};
