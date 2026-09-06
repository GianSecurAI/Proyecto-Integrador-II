import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { VerifyCodePage } from './verify-code.page';

describe('VerifyCodePage', () => {
  let fixture: ComponentFixture<VerifyCodePage>;
  let component: VerifyCodePage;
  let httpMock: HttpTestingController;
  let router: Router;
  const verifyUrl = `${environment.apiBaseUrl}/auth/otp/verify`;

  function createWithState(state: { email?: string } | null) {
    history.replaceState(state, '');
    TestBed.configureTestingModule({
      imports: [VerifyCodePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(VerifyCodePage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
    history.replaceState(null, '');
  });

  it('has no password field anywhere on this screen (Constitution Principle VI)', () => {
    createWithState({ email: 'customer@example.com' });
    const inputs: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input'));
    expect(inputs.some((el) => el.type === 'password')).toBe(false);
  });

  it('redirects back to request-code when reached without a known email', () => {
    createWithState(null);

    expect(router.navigate).toHaveBeenCalledWith(['/auth/request-code']);
  });

  it('shows "account created" wording only when accountStatus is created, and navigates to /account', () => {
    createWithState({ email: 'new@example.com' });
    component.codeControl.setValue('123456');
    component.submit();

    httpMock.expectOne(verifyUrl).flush({ accountStatus: 'created' });

    expect(component.successMessage()).toContain('Cuenta creada');
    expect(router.navigate).toHaveBeenCalledWith(['/account']);
  });

  it('shows "welcome back" wording when accountStatus is existing', () => {
    createWithState({ email: 'returning@example.com' });
    component.codeControl.setValue('123456');
    component.submit();

    httpMock.expectOne(verifyUrl).flush({ accountStatus: 'existing' });

    expect(component.successMessage()).toContain('Bienvenido de nuevo');
  });

  it('surfaces a rejection message on 401 (wrong code)', () => {
    createWithState({ email: 'customer@example.com' });
    component.codeControl.setValue('000000');
    component.submit();

    httpMock
      .expectOne(verifyUrl)
      .flush(
        { code: 'OTP_INVALID', message: 'Código incorrecto.', timestamp: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(component.errorMessage()).toBe('Código incorrecto.');
  });

  it('surfaces a rejection message on 410 (expired or already used)', () => {
    createWithState({ email: 'customer@example.com' });
    component.codeControl.setValue('123456');
    component.submit();

    httpMock
      .expectOne(verifyUrl)
      .flush(
        { code: 'OTP_EXPIRED', message: 'Código expirado.', timestamp: 'x' },
        { status: 410, statusText: 'Gone' },
      );

    expect(component.errorMessage()).toBe('Código expirado.');
  });

  it('surfaces a rejection message on 429 (attempt limit reached)', () => {
    createWithState({ email: 'customer@example.com' });
    component.codeControl.setValue('123456');
    component.submit();

    httpMock
      .expectOne(verifyUrl)
      .flush(
        { code: 'RATE_LIMITED', message: 'Demasiados intentos.', timestamp: 'x' },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(component.errorMessage()).toBe('Demasiados intentos.');
  });
});
