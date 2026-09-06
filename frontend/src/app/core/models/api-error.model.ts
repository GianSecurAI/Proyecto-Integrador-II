/**
 * Shared error envelope returned by every non-2xx backend response
 * (`{ code, message, timestamp }`), per Constitution Principle IX and
 * `specs/001-customer-otp-auth/contracts/otp-auth-api.md`. Every feature's HTTP layer
 * should type its error bodies against this shape instead of inventing its own.
 */
export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
}
