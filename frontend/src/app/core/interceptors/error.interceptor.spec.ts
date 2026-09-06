import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
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

  it('redirects to the unexpected-error page on a 500', () => {
    http.get('/api/customers/me').subscribe({ error: () => undefined });

    httpMock
      .expectOne('/api/customers/me')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(router.navigate).toHaveBeenCalledWith(['/unexpected-error']);
  });
});
