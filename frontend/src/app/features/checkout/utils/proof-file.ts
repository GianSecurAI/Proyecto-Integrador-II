/**
 * UX-only checks for the payment-proof upload. The backend re-validates everything (type by
 * magic bytes, 5 MB, structure, method, operation code) and its verdict is authoritative
 * (Prohibited Practice #6).
 */
export const PROOF_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PROOF_ALLOWED_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const OPERATION_CODE_PATTERN = /^[A-Za-z0-9]{6,20}$/;

/** Spanish message for the first problem found with the chosen file, or `null` when it looks fine. */
export function validateProofFile(file: File): string | null {
  if (!PROOF_ALLOWED_TYPES.includes(file.type)) {
    return 'El comprobante debe ser una imagen JPG, PNG o WebP.';
  }
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > PROOF_MAX_BYTES) return 'La imagen supera el máximo de 5 MB.';
  return null;
}

/** Empty is valid (the code is optional). */
export function validateOperationCode(value: string): string | null {
  const code = value.trim();
  if (code === '') return null;
  return OPERATION_CODE_PATTERN.test(code)
    ? null
    : 'El código de operación debe tener entre 6 y 20 letras o números.';
}
