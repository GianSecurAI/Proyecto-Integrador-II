import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { SessionStateService } from '../../../../core/services/session-state.service';
import {
  AUTH_PREVIEW,
  AuthPreview,
  AuthPreviewError,
  MOCK_EXPIRED_OTP,
  MOCK_INVALID_OTP,
  VerifyOtpResult,
} from '../../services/auth-preview.service';
import { VerifyCodePage } from './verify-code.page';

/** Lightweight `ActivatedRoute` fake, same narrow-mocking convention already used by
 * `admin-incident-list.page.spec.ts`/`admin-order-list.page.spec.ts`: only exposes what this page
 * actually reads (`snapshot.queryParamMap`, for `?returnUrl=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return { snapshot: { queryParamMap: map } as ActivatedRouteSnapshot };
}

const CLIENTE_RESULT: VerifyOtpResult = { role: 'CLIENTE', email: 'customer@example.com' };
const ASESOR_RESULT: VerifyOtpResult = { role: 'ASESOR', email: 'asesor.andrea@armakers3d.com' };
const ADMIN_RESULT: VerifyOtpResult = { role: 'ADMINISTRADOR', email: 'admin.principal@armakers3d.com' };

describe('VerifyCodePage', () => {
  let fixture: ComponentFixture<VerifyCodePage>;
  let component: VerifyCodePage;
  let auth: jasmine.SpyObj<AuthPreview>;
  let router: Router;
  let session: SessionStateService;

  async function setup(queryParams: Record<string, string> = {}) {
    auth = jasmine.createSpyObj<AuthPreview>('AuthPreview', [
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
        { provide: AUTH_PREVIEW, useValue: auth },
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(queryParams) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VerifyCodePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStateService);
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

  it('announces mock completion, marks the session and navigates to the CLIENTE default', () => {
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.completed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'verificó',
    );
    expect(component.codeControl.value).toBe('');
    expect(session.isAuthenticated()).toBeTrue();
    expect(session.currentRole()).toBe('CLIENTE');
    expect(session.currentEmail()).toBe('customer@example.com');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('resolves an ASESOR verification to the shared staff landing page', () => {
    auth.verifyOtp.and.returnValue(of(ASESOR_RESULT));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(session.currentRole()).toBe('ASESOR');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('resolves an ADMINISTRADOR verification to the admin shell', () => {
    auth.verifyOtp.and.returnValue(of(ADMIN_RESULT));
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(session.currentRole()).toBe('ADMINISTRADOR');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
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
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('cancels verification and resets preview on leaving', () => {
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

  it('shows a distinct message when the mock expired code is used', () => {
    auth.verifyOtp.and.returnValue(throwError(() => new AuthPreviewError('expired')));
    fixture.detectChanges();
    component.codeControl.setValue(MOCK_EXPIRED_OTP);
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('Este código expiró. Solicita uno nuevo.');
  });

  it('shows a distinct message when the mock invalid code is used', () => {
    auth.verifyOtp.and.returnValue(throwError(() => new AuthPreviewError('invalid')));
    fixture.detectChanges();
    component.codeControl.setValue(MOCK_INVALID_OTP);
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('El código ingresado no es válido.');
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
