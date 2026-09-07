import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import {
  AUTH_PREVIEW,
  AuthPreview,
  AuthPreviewError,
  MOCK_EXPIRED_OTP,
  MOCK_INVALID_OTP,
} from '../../services/auth-preview.service';
import { VerifyCodePage } from './verify-code.page';

describe('VerifyCodePage', () => {
  let fixture: ComponentFixture<VerifyCodePage>;
  let component: VerifyCodePage;
  let auth: jasmine.SpyObj<AuthPreview>;
  let router: Router;
  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthPreview>('AuthPreview', [
      'requestOtp',
      'verifyOtp',
      'reset',
      'hasPendingRequest',
    ]);
    auth.hasPendingRequest.and.returnValue(true);
    auth.verifyOtp.and.returnValue(of(undefined));
    auth.requestOtp.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [VerifyCodePage],
      providers: [provideRouter([]), { provide: AUTH_PREVIEW, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(VerifyCodePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
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
    auth.verifyOtp.and.returnValue(new Subject<void>());
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    component.submit();
    fixture.detectChanges();
    expect(auth.verifyOtp).toHaveBeenCalledOnceWith('123456');
    expect(component.codeControl.value).toBe('');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });
  it('announces mock completion without routing to a protected account', () => {
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.detectChanges();
    expect(component.completed()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'demostración',
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.codeControl.value).toBe('');
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
  it('cancels verification and resets preview on leaving', () => {
    const pending = new Subject<void>();
    auth.verifyOtp.and.returnValue(pending);
    fixture.detectChanges();
    component.codeControl.setValue('123456');
    component.submit();
    fixture.destroy();
    pending.next();
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
