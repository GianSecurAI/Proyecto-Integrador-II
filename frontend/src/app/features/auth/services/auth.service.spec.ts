import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SessionStateService } from '../../../core/services/session-state.service';
import { environment } from '../../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let session: SessionStateService;
  const baseUrl = `${environment.apiBaseUrl}/auth/otp`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStateService);
  });

  afterEach(() => httpMock.verify());

  it('POSTs only the email to /auth/otp/request and returns the backend message verbatim', () => {
    let result: { message: string } | undefined;

    service.requestOtp('customer@example.com').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'customer@example.com' });
    expect(req.request.withCredentials).toBe(true);

    req.flush({ message: 'If this email is valid, a code has been sent.' });

    expect(result?.message).toBe('If this email is valid, a code has been sent.');
  });

  it('does not mark the session authenticated on a request-otp call (no session is created by this endpoint)', () => {
    service.requestOtp('customer@example.com').subscribe();
    httpMock.expectOne(`${baseUrl}/request`).flush({ message: 'ok' });

    expect(session.isAuthenticated()).toBe(false);
  });

  it('POSTs email and code to /auth/otp/verify and marks the session authenticated on success', () => {
    let result: { accountStatus: string } | undefined;

    service.verifyOtp('customer@example.com', '123456').subscribe((res) => (result = res));

    const req = httpMock.expectOne(`${baseUrl}/verify`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'customer@example.com', code: '123456' });
    expect(req.request.withCredentials).toBe(true);

    req.flush({ accountStatus: 'created' });

    expect(result?.accountStatus).toBe('created');
    expect(session.isAuthenticated()).toBe(true);
    expect(session.currentRole()).toBe('CLIENTE');
  });

  it('does not mark the session authenticated when verification fails', () => {
    service.verifyOtp('customer@example.com', '000000').subscribe({ error: () => undefined });

    httpMock
      .expectOne(`${baseUrl}/verify`)
      .flush(
        { code: 'OTP_INVALID', message: 'x', timestamp: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(session.isAuthenticated()).toBe(false);
  });
});
