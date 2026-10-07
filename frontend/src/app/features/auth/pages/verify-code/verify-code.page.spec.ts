import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { AuthService, VerifyOtpResult } from '../../services/auth.service';
import { VerifyCodePage } from './verify-code.page';

/** Lightweight `ActivatedRoute` fake, same narrow-mocking convention already used by
 * `admin-incident-list.page.spec.ts`/`admin-order-list.page.spec.ts`: only exposes what this page
 * actually reads (`snapshot.queryParamMap`, for `?returnUrl=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return { snapshot: { queryParamMap: map } as ActivatedRouteSnapshot };
}

const CLIENTE_RESULT: VerifyOtpResult = { role: 'CLIENTE', email: 'customer@example.com', accountStatus: 'existing' };
const ASESOR_RESULT: VerifyOtpResult = { role: 'ASESOR', email: 'asesor.andrea@armakers3d.com', accountStatus: 'existing' };
const ADMIN_RESULT: VerifyOtpResult = { role: 'ADMINISTRADOR', email: 'admin.principal@armakers3d.com', accountStatus: 'existing' };

describe('VerifyCodePage', () => {
  let fixture: ComponentFixture<VerifyCodePage>;
  let component: VerifyCodePage;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  async function setup(queryParams: Record<string, string> = {}) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'requestOtp',
      'verifyOtp',
      'reset',
      'hasPendingRequest',
    ]);
    auth.hasPendingRequest.and.returnValue(true);
    auth.verifyOtp.and.returnValue(of(CLIENTE_RESULT));
    auth.requestOtp.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [VerifyCodePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(queryParams) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VerifyCodePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(async () => {
    await setup();
  });

  it('returns direct or refreshed visits to the email step', () => {
    auth.hasPendingRequest.and.returnValue(false);
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/request-code']);
  });

  it('rejects malformed input with accessible feedback', () => {
    fixture.detectChanges();
    component.codeControl.setValue('12ab');
    component.submit();
    fixture.detectChanges();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input').getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the OTP immediately, shows loading, prevents duplicate submits', () => {
    auth.verifyOtp.and.returnValue(new Subject<VerifyOtpResult>());
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    component.submit();
    fixture.detectChanges();
    expect(auth.verifyOtp).toHaveBeenCalledOnceWith('123456');
    expect(component.codeControl.value).toBe('');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });

  it('announces completion and navigates to the CLIENTE default (session is recorded by AuthService)', () => {
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.completed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'verificó',
    );
    expect(component.codeControl.value).toBe('');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('resolves an ASESOR verification to the shared staff landing page', () => {
    auth.verifyOtp.and.returnValue(of(ASESOR_RESULT));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('resolves an ADMINISTRADOR verification to the admin shell', () => {
    auth.verifyOtp.and.returnValue(of(ADMIN_RESULT));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('ignores an unsafe returnUrl (open-redirect guard) and uses the role default', async () => {
    TestBed.resetTestingModule();
    await setup({ returnUrl: 'https://evil.example/x' });
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('honors an explicit returnUrl over the per-role default', async () => {
    TestBed.resetTestingModule();
    await setup({ returnUrl: '/admin/orders' });
    auth.verifyOtp.and.returnValue(of(ASESOR_RESULT));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/orders');
  });

  it('shows a generic error and clears the code on failure', () => {
    auth.verifyOtp.and.returnValue(throwError(() => new Error('Secret detail')));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toContain('No pudimos verificar');
    expect(component.codeControl.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Secret detail');
  });

  it('cancels verification and resets the OTP challenge on leaving', () => {
    const pending = new Subject<VerifyOtpResult>();
    auth.verifyOtp.and.returnValue(pending);
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.destroy();
    pending.next(CLIENTE_RESULT);
    expect(component.completed()).toBeFalse();
    expect(auth.reset).toHaveBeenCalled();
    expect(component.codeControl.value).toBe('');
  });

  function apiError(status: number, code: string): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: { code, message: 'x', timestamp: 't' } });
  }

  it('shows a distinct message for OTP_EXPIRED (410)', () => {
    auth.verifyOtp.and.returnValue(throwError(() => apiError(410, 'OTP_EXPIRED')));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('Este código expiró. Solicita uno nuevo.');
  });

  it('shows a distinct message for OTP_INVALID (401)', () => {
    auth.verifyOtp.and.returnValue(throwError(() => apiError(401, 'OTP_INVALID')));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('El código ingresado no es válido.');
  });

  it('shows the attempt-limit message for OTP_ATTEMPTS_EXCEEDED (429)', () => {
    auth.verifyOtp.and.returnValue(throwError(() => apiError(429, 'OTP_ATTEMPTS_EXCEEDED')));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    expect(component.errorMessage()).toContain('intentos');
  });

  it('resends in place without navigating away', () => {
    fixture.detectChanges();
    component.requestNewCode();
    expect(auth.requestOtp).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('disables the resend button during cooldown and re-enables once it elapses', fakeAsync(() => {
    fixture.detectChanges();
    component.requestNewCode();
    fixture.detectChanges();
    expect(component.resendCooldown()).toBe(30);
    const resendButton = () =>
      fixture.nativeElement.querySelectorAll('.auth-card__meta button')[0] as HTMLButtonElement;
    expect(resendButton().disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Reenviar en 0:30');
    tick(1000);
    fixture.detectChanges();
    expect(component.resendCooldown()).toBe(29);
    expect(fixture.nativeElement.textContent).toContain('Reenviar en 0:29');
    tick(29_000);
    fixture.detectChanges();
    expect(component.resendCooldown()).toBe(0);
    expect(resendButton().disabled).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Solicitar otro código');
  }));

  it('ignores resend clicks while a cooldown is already running', () => {
    fixture.detectChanges();
    component.requestNewCode();
    component.requestNewCode();
    expect(auth.requestOtp).toHaveBeenCalledTimes(1);
  });
});
