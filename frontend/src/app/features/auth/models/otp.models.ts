/**
 * DTO shapes mirroring `specs/001-customer-otp-auth/contracts/otp-auth-api.md` exactly. These
 * are transport types only — no validity/business-rule logic lives here (Prohibited Practice
 * #5); that is entirely the backend's responsibility.
 */

export interface OtpRequestPayload {
  email: string;
}

export interface OtpRequestResponse {
  message: string;
}

export interface OtpVerifyPayload {
  email: string;
  code: string;
}

/** `accountStatus` is the only point at which the API may reveal new-vs-existing (FR-004a). */
export interface OtpVerifyResponse {
  accountStatus: 'created' | 'existing';
}
