import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { credentialsInterceptor } from './credentials.interceptor';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpMock.verify());

  it('sends credentials to the backend API', () => {
    http.get(`${environment.apiBaseUrl}/auth/me`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('leaves other URLs untouched', () => {
    http.get('https://example.com/x').subscribe();
    const req = httpMock.expectOne('https://example.com/x');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });
});
