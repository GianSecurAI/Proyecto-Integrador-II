import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { makeFile } from '../testing/checkout-fixtures';
import { checkoutActionErrorMessage, proofUploadErrorMessage } from './checkout-error-messages';
import { PROOF_MAX_BYTES, validateOperationCode, validateProofFile } from './proof-file';

function err(status: number, code?: string, headers?: HttpHeaders): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    headers,
    error: code ? { code, message: 'x', timestamp: 't' } : null,
  });
}

describe('validateProofFile (UX only)', () => {
  it('accepts JPEG, PNG and WebP up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateProofFile(makeFile('a', type))).toBeNull();
    }
    expect(validateProofFile(makeFile('a', 'image/png', PROOF_MAX_BYTES))).toBeNull();
  });

  it('rejects other types, empty files and files above 5 MB', () => {
    expect(validateProofFile(makeFile('a.gif', 'image/gif'))).toContain('JPG, PNG o WebP');
    expect(validateProofFile(makeFile('a.svg', 'image/svg+xml'))).toContain('JPG, PNG o WebP');
    expect(validateProofFile(makeFile('a.pdf', 'application/pdf'))).toContain('JPG, PNG o WebP');
    expect(validateProofFile(makeFile('a.png', 'image/png', 0))).toContain('vacío');
    expect(validateProofFile(makeFile('a.png', 'image/png', PROOF_MAX_BYTES + 1))).toContain('5 MB');
  });
});

describe('validateOperationCode (UX only)', () => {
  it('treats blank as valid and enforces [A-Za-z0-9]{6,20}', () => {
    expect(validateOperationCode('')).toBeNull();
    expect(validateOperationCode('   ')).toBeNull();
    expect(validateOperationCode('AB12CD')).toBeNull();
    expect(validateOperationCode('a'.repeat(20))).toBeNull();
    expect(validateOperationCode('AB12')).not.toBeNull();
    expect(validateOperationCode('a'.repeat(21))).not.toBeNull();
    expect(validateOperationCode('AB12-CD34')).not.toBeNull();
  });
});

describe('proofUploadErrorMessage', () => {
  it('maps each documented error to a friendly message', () => {
    expect(proofUploadErrorMessage(err(400, 'INVALID_PROOF_IMAGE'))).toContain('dañada');
    expect(proofUploadErrorMessage(err(415, 'UNSUPPORTED_IMAGE_TYPE'))).toContain('JPG, PNG o WebP');
    expect(proofUploadErrorMessage(err(413, 'PAYLOAD_TOO_LARGE'))).toContain('5 MB');
    expect(proofUploadErrorMessage(err(413))).toContain('5 MB');
    expect(proofUploadErrorMessage(err(409, 'PROOF_ATTEMPTS_EXCEEDED'))).toContain('máximo de comprobantes');
    expect(proofUploadErrorMessage(err(409, 'CHECKOUT_STATE_CONFLICT'))).toContain('cambió de estado');
    expect(proofUploadErrorMessage(err(404, 'NOT_FOUND'))).toContain('No encontramos');
    expect(proofUploadErrorMessage(err(503, 'PROOF_STORAGE_UNAVAILABLE'))).toContain('minutos');
    expect(proofUploadErrorMessage(err(500))).toContain('No pudimos subir');
  });

  it('429 includes the Retry-After wait', () => {
    const message = proofUploadErrorMessage(err(429, 'RATE_LIMITED', new HttpHeaders({ 'Retry-After': '30' })));
    expect(message).toContain('30 segundos');
  });
});

describe('checkoutActionErrorMessage', () => {
  it('maps 404, conflict, 429 and falls back otherwise', () => {
    expect(checkoutActionErrorMessage(err(404), 'f')).toContain('No encontramos');
    expect(checkoutActionErrorMessage(err(409, 'CHECKOUT_STATE_CONFLICT'), 'f')).toContain('cambió de estado');
    expect(checkoutActionErrorMessage(err(429, 'RATE_LIMITED'), 'f')).toContain('Demasiados intentos');
    expect(checkoutActionErrorMessage(err(500), 'fallback')).toBe('fallback');
  });
});
