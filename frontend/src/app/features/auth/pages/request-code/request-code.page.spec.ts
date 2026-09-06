import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { RequestCodePage } from './request-code.page';

describe('RequestCodePage', () => {
  let fixture: ComponentFixture<RequestCodePage>;
  let component: RequestCodePage;
  let httpMock: HttpTestingController;
  let router: Router;
  const requestUrl = `${environment.apiBaseUrl}/auth/otp/request`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestCodePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestCodePage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('has no password field anywhere on this screen (Constitution Principle VI)', () => {
    const inputs: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input'));
    expect(inputs.some((el) => el.type === 'password')).toBe(false);
  });

  it('does not call the API when the email is invalid', () => {
    component.emailControl.setValue('not-an-email');
    component.submit();

    httpMock.expectNone(requestUrl);
    expect(component.emailControl.touched).toBe(true);
  });

  it('shows the backend-provided generic acknowledgment and navigates to verify-code on 202, carrying the email', () => {
    component.emailControl.setValue('customer@example.com');
    component.submit();

    httpMock
      .expectOne(requestUrl)
      .flush({ message: 'If this email is valid, a code has been sent.' });

    expect(component.successMessage()).toBe('If this email is valid, a code has been sent.');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-code'], {
      state: { email: 'customer@example.com' },
    });
  });

  it('shows an inline error on 400 using the backend message', () => {
    component.emailControl.setValue('customer@example.com');
    component.submit();

    httpMock
      .expectOne(requestUrl)
      .flush(
        { code: 'VALIDATION_ERROR', message: 'Correo inválido.', timestamp: 'x' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(component.errorMessage()).toBe('Correo inválido.');
  });

  it('shows a generic retry-later message on 429 without hinting at the reason', () => {
    component.emailControl.setValue('customer@example.com');
    component.submit();

    httpMock
      .expectOne(requestUrl)
      .flush(
        { code: 'RATE_LIMITED', message: 'Too many requests, try again later.', timestamp: 'x' },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(component.errorMessage()).toBe('Too many requests, try again later.');
  });
});
