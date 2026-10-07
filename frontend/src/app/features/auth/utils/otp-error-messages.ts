import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../core/models/api-error.model';

/** User-facing copy for the documented outcomes of `POST /api/auth/otp/request` (400, 429). */
export function requestOtpErrorMessage(err: unknown): string {
  const status = httpStatus(err);
  if (status === 400) return 'Revisa el correo electrónico ingresado.';
  if (status === 429) return rateLimitMessage(err);
  return 'No pudimos continuar. Inténtalo de nuevo más tarde.';
}

/** User-facing copy for the documented outcomes of `POST /api/auth/otp/verify`
 * (OTP_INVALID 401, OTP_EXPIRED/OTP_ALREADY_USED 410, OTP_ATTEMPTS_EXCEEDED 429,
 * ACCOUNT_DEACTIVATED 403). */
export function verifyOtpErrorMessage(err: unknown): string {
  switch (apiErrorCode(err)) {
    case 'OTP_INVALID':
      return 'El código ingresado no es válido.';
    case 'OTP_EXPIRED':
      return 'Este código expiró. Solicita uno nuevo.';
    case 'OTP_ALREADY_USED':
      return 'Este código ya fue utilizado. Solicita uno nuevo.';
    case 'OTP_ATTEMPTS_EXCEEDED':
      return 'Superaste el número de intentos. Solicita un código nuevo.';
    case 'RATE_LIMITED':
      return rateLimitMessage(err);
    case 'ACCOUNT_DEACTIVATED':
      return 'Esta cuenta no está disponible.';
    default:
      return 'No pudimos verificar el código. Inténtalo de nuevo o solicita otro.';
  }
}
