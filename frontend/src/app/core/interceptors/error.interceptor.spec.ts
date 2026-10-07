import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NAVIGATE_ON_ERROR, errorInterceptor } from './error.interceptor';
import { SessionStateService } from '../services/session-state.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let session: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStateService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => httpMock.verify());

  it('does not redirect on a 401 from the OTP verify endpoint (business rejection, not a session failure)', () => {
    http.post('/api/auth/otp/verify', {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/otp/verify')
      .flush(
        { code: 'OTP_INVALID', message: 'x', timestamp: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 from GET /auth/me (session probe: anonymous, handled by AuthService)', () => {
    http.get('/api/auth/me').subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/auth/me')
      .flush({ code: 'UNAUTHENTICATED', message: 'x', timestamp: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not go to /forbidden on a 403 ACCOUNT_DEACTIVATED from OTP verify (shown inline)', () => {
    http.post('/api/auth/otp/verify', {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne('/api/auth/otp/verify')
      .flush({ code: 'ACCOUNT_DEACTIVATED', message: 'x', timestamp: 'x' }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not redirect on a 429 from the OTP request endpoint', () => {
    http.post('/api/auth/otp/request', {}).subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/auth/otp/request')
      .flush(
        { code: 'RATE_LIMITED', message: 'x', timestamp: 'x' },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to request-code and clears the session on a 401 from a protected endpoint', () => {
    session.markAuthenticated('CLIENTE');

    http.get('/api/customers/me').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/customers/me')
      .flush(
        { code: 'UNAUTHORIZED', message: 'x', timestamp: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(session.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/request-code']);
  });

  it('redirects to the forbidden page on a 403 from a protected endpoint', () => {
    http.get('/api/customers/other').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/customers/other')
      .flush(
        { code: 'FORBIDDEN', message: 'x', timestamp: 'x' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
  });

  it('does NOT navigate on a 5xx by default (pages show their inline retry state)', () => {
    http.get('/api/customers/me').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/customers/me').flush('boom', { status: 503, statusText: 'Unavailable' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does NOT navigate on a network failure (status 0) by default', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/orders').error(new ProgressEvent('error'));
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the unexpected-error page on a 500 only when NAVIGATE_ON_ERROR is set', () => {
    http
      .get('/api/customers/me', { context: new HttpContext().set(NAVIGATE_ON_ERROR, true) })
      .subscribe({ error: () => undefined });
    httpMock.expectOne('/api/customers/me').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(router.navigate).toHaveBeenCalledWith(['/unexpected-error']);
  });

  it('still redirects a 401 even when NAVIGATE_ON_ERROR is not set', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/orders').flush('x', { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/request-code']);
  });
});
