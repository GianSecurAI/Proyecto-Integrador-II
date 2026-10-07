import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SessionStateService } from '../../../core/services/session-state.service';
import { AuthService } from './auth.service';

/**
 * Contract-conformance spec: request/response bodies below are copied from the backend's real
 * shapes (`OtpRequestDto`, `OtpRequestResponseDto`, `OtpVerifyResponseDto`, `MeResponseDto`).
 */
describe('AuthService (real HTTP, contract shapes)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let session: SessionStateService;
  const base = `${environment.apiBaseUrl}/auth`;
  const accepted = { status: 202, statusText: 'Accepted' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStateService);
  });
  afterEach(() => httpMock.verify());

  it('POSTs only the trimmed email to /auth/otp/request and records a pending challenge', () => {
    service.requestOtp(' customer@example.com ').subscribe();
    const req = httpMock.expectOne(`${base}/otp/request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'customer@example.com' });
    req.flush({ message: 'If this email is valid, a code has been sent.' }, accepted);
    expect(service.hasPendingRequest()).toBeTrue();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('sends non-blank optional profile fields and omits blank ones', () => {
    service
      .requestOtp('a@b.co', { firstName: 'Ana', lastName: ' ', phone: '987 654 321' })
      .subscribe();
    const req = httpMock.expectOne(`${base}/otp/request`);
    expect(req.request.body).toEqual({ email: 'a@b.co', firstName: 'Ana', phone: '987 654 321' });
    req.flush({ message: 'ok' }, accepted);
  });

  it('does not stay pending when the request is rejected (429)', () => {
    service.requestOtp('a@b.co').subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/otp/request`)
      .flush(
        { code: 'OTP_REQUEST_THROTTLED', message: 'x', timestamp: 't' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    expect(service.hasPendingRequest()).toBeFalse();
  });

  it('verifies, reads the identity back from /auth/me and marks the session with server values', () => {
    service.requestOtp('staff@armakers3d.com').subscribe();
    httpMock.expectOne(`${base}/otp/request`).flush({ message: 'ok' }, accepted);

    let result: unknown;
    service.verifyOtp('123456').subscribe((r) => (result = r));
    const verify = httpMock.expectOne(`${base}/otp/verify`);
    expect(verify.request.body).toEqual({ email: 'staff@armakers3d.com', code: '123456' });
    verify.flush({ accountStatus: 'existing', role: 'ASESOR' });
    httpMock.expectOne(`${base}/me`).flush({ id: 7, email: 'staff@armakers3d.com', role: 'ASESOR' });

    expect(result).toEqual({
      role: 'ASESOR',
      email: 'staff@armakers3d.com',
      accountStatus: 'existing',
    });
    expect(session.currentRole()).toBe('ASESOR');
    expect(session.currentUserId()).toBe(7);
    expect(service.hasPendingRequest()).toBeFalse();
  });

  it('does not mark the session authenticated when verification fails (OTP_INVALID 401)', () => {
    service.requestOtp('a@b.co').subscribe();
    httpMock.expectOne(`${base}/otp/request`).flush({ message: 'ok' }, accepted);
    service.verifyOtp('000000').subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/otp/verify`)
      .flush(
        { code: 'OTP_INVALID', message: 'x', timestamp: 't' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(session.isAuthenticated()).toBeFalse();
    expect(service.hasPendingRequest()).toBeTrue();
  });

  it('restoreSession marks the server-reported identity', () => {
    service.restoreSession().subscribe();
    httpMock.expectOne(`${base}/me`).flush({ id: 3, email: 'c@x.pe', role: 'CLIENTE' });
    expect(session.authStatus()).toBe('authenticated');
    expect(session.currentUserId()).toBe(3);
  });

  it('restoreSession leaves the visitor anonymous on 401 without erroring', () => {
    let completed = false;
    service.restoreSession().subscribe({ complete: () => (completed = true) });
    httpMock
      .expectOne(`${base}/me`)
      .flush(
        { code: 'UNAUTHENTICATED', message: 'x', timestamp: 't' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(completed).toBeTrue();
    expect(session.authStatus()).toBe('anonymous');
  });

  it('logout POSTs /auth/logout and clears local state even if the request fails', () => {
    session.markAuthenticated('CLIENTE', 'c@x.pe', 3);
    service.logout().subscribe();
    const req = httpMock.expectOne(`${base}/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 500, statusText: 'Server Error' });
    expect(session.isAuthenticated()).toBeFalse();
  });
});
