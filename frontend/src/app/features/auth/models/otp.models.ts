import { Role } from '../../../shared/models/wire-enums';

/**
 * Wire shapes of the auth endpoints (backend `auth/dto/*`). Transport types only — validity,
 * throttling, account creation and role assignment are the backend's decisions.
 */

/** Optional profile fields accepted by the request endpoint (all optional, omitted when blank). */
export interface OtpProfileFields {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** `POST /api/auth/otp/request` body. */
export interface OtpRequestPayload extends OtpProfileFields {
  email: string;
}

/** 202 body — identical whether or not the email exists (anti-enumeration). */
export interface OtpRequestResponse {
  message: string;
}

export interface OtpVerifyPayload {
  email: string;
  code: string;
}

/** `POST /api/auth/otp/verify` 200 body. `accountStatus` is the only point where new-vs-existing
 * is revealed; `role` is what the server resolved for the account. */
export interface OtpVerifyResponse {
  accountStatus: 'created' | 'existing';
  role: Role;
}

/** `GET /api/auth/me` 200 body (backend `MeResponseDto`). */
export interface MeResponse {
  id: number;
  email: string;
  role: Role;
}
