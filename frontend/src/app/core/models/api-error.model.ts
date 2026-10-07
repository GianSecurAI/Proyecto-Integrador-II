import { HttpErrorResponse } from '@angular/common/http';

/** One entry of `ApiError.fieldErrors` (backend `ApiError.FieldError`). `field` may be a nested
 * path such as `delivery.address` or `items[0].quantity`. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/**
 * Shared error envelope returned by every non-2xx backend response (backend
 * `shared/error/ApiError`): `{ code, message, timestamp, fieldErrors? }`. `fieldErrors` is only
 * present for `400 VALIDATION_FAILED`. Every feature's HTTP layer types its error bodies against
 * this shape instead of inventing its own.
 *
 * Codes seen on the wire (see docs/reviews/frontend-backend-integration.md): VALIDATION_FAILED,
 * MALFORMED_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, OTP_INVALID, OTP_EXPIRED,
 * OTP_ALREADY_USED, OTP_ATTEMPTS_EXCEEDED / rate-limit codes (429), INVALID_STATUS_TRANSITION,
 * IDEMPOTENCY_KEY_REUSED, PRODUCT_UNAVAILABLE, CUSTOMER_NOT_ELIGIBLE, LAST_ADMINISTRATOR,
 * SELF_MODIFICATION_NOT_ALLOWED, INTERNAL_ERROR.
 */
export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  fieldErrors?: ApiFieldError[];
}

/** Narrows an unknown thrown value to the backend error envelope, or `null` when the failure has
 * no such body (network error, proxy error page, ...). */
export function toApiError(err: unknown): ApiError | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body: unknown = err.error;
  if (typeof body === 'object' && body !== null && typeof (body as ApiError).code === 'string') {
    return body as ApiError;
  }
  return null;
}

/** Backend error `code`, when the error carries the envelope. */
export function apiErrorCode(err: unknown): string | null {
  return toApiError(err)?.code ?? null;
}

/** HTTP status of a failed request, or `null` for non-HTTP errors. */
export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}
