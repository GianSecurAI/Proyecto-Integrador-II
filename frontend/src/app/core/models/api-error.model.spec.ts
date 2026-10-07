import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { rateLimitMessage, retryAfterSeconds, withRateLimit } from './api-error.model';

function tooMany(retryAfter?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 429,
    headers: retryAfter ? new HttpHeaders({ 'Retry-After': retryAfter }) : undefined,
    error: { code: 'RATE_LIMITED', message: 'x', timestamp: 't' },
  });
}

describe('rate-limit helpers (429 RATE_LIMITED + Retry-After)', () => {
  it('reads Retry-After seconds, ignoring missing or invalid values', () => {
    expect(retryAfterSeconds(tooMany('30'))).toBe(30);
    expect(retryAfterSeconds(tooMany())).toBeNull();
    expect(retryAfterSeconds(tooMany('soon'))).toBeNull();
    expect(retryAfterSeconds(new Error('x'))).toBeNull();
  });

  it('names the wait when Retry-After is present', () => {
    expect(rateLimitMessage(tooMany('30'))).toContain('30 segundos');
    expect(rateLimitMessage(tooMany('60'))).toContain('1 minuto');
    expect(rateLimitMessage(tooMany('600'))).toContain('10 minutos');
  });

  it('falls back to generic friendly copy without Retry-After', () => {
    expect(rateLimitMessage(tooMany())).toBe(
      'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    );
  });

  it('withRateLimit only overrides the fallback on a 429', () => {
    expect(withRateLimit(tooMany('5'), 'fallback')).toContain('5 segundos');
    expect(withRateLimit(new HttpErrorResponse({ status: 500 }), 'fallback')).toBe('fallback');
  });
});
