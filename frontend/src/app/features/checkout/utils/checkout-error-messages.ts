import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../core/models/api-error.model';

/** Friendly Spanish copy for a failed `POST /api/checkout/{id}/proof`. */
export function proofUploadErrorMessage(err: unknown): string {
  const status = httpStatus(err);
  const code = apiErrorCode(err);
  if (status === 429) return rateLimitMessage(err);
  switch (code) {
    case 'INVALID_PROOF_IMAGE':
      return 'No pudimos leer la imagen: parece dañada o incompleta. Toma una nueva captura e inténtalo otra vez.';
    case 'UNSUPPORTED_IMAGE_TYPE':
      return 'Formato no admitido. Sube una imagen JPG, PNG o WebP.';
    case 'PROOF_ATTEMPTS_EXCEEDED':
      return 'Alcanzaste el máximo de comprobantes para este pago. Cancela este pago e inicia uno nuevo.';
    case 'CHECKOUT_STATE_CONFLICT':
      return 'Este pago ya cambió de estado y no admite un nuevo comprobante. Actualizamos la información.';
    case 'PROOF_STORAGE_UNAVAILABLE':
      return 'No pudimos guardar el comprobante en este momento. Inténtalo de nuevo en unos minutos.';
    case 'VALIDATION_FAILED':
      return 'Revisa el método de pago y el código de operación e inténtalo de nuevo.';
    default:
      break;
  }
  if (status === 413) return 'La imagen supera el máximo de 5 MB.';
  if (status === 415) return 'Formato no admitido. Sube una imagen JPG, PNG o WebP.';
  if (status === 404) return 'No encontramos este pago.';
  return 'No pudimos subir el comprobante. Inténtalo de nuevo.';
}

/** Copy for a failed read/cancel of a checkout. */
export function checkoutActionErrorMessage(err: unknown, fallback: string): string {
  const status = httpStatus(err);
  if (status === 429) return rateLimitMessage(err);
  if (status === 404) return 'No encontramos este pago.';
  if (apiErrorCode(err) === 'CHECKOUT_STATE_CONFLICT') {
    return 'Este pago ya cambió de estado y no se puede cancelar. Actualizamos la información.';
  }
  return fallback;
}
