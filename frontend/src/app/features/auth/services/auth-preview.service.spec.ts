import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SessionStateService } from '../../../core/services/session-state.service';
import {
  AuthMockService,
  AuthPreviewError,
  MOCK_EXPIRED_OTP,
  MOCK_INVALID_OTP,
  VerifyOtpResult,
} from './auth-preview.service';

describe('AuthMockService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('completes only the in-memory preview without HTTP, storage or real session changes', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    const session = TestBed.inject(SessionStateService);
    const mark = spyOn(session, 'markAuthenticated');
    const local = spyOn(Storage.prototype, 'setItem');
    const historyWrite = spyOn(history, 'pushState');
    mock.requestOtp().subscribe();
    tick(500);
    expect(mock.hasPendingRequest()).toBeTrue();
    let completed = false;
    mock.verifyOtp('123456').subscribe(() => (completed = true));
    tick(500);
    expect(completed).toBeTrue();
    expect(mock.hasPendingRequest()).toBeFalse();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(mark).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
    expect(historyWrite).not.toHaveBeenCalled();
  }));
  it('does not simulate verification before a request', () => {
    let failed = false;
    TestBed.inject(AuthMockService)
      .verifyOtp('123456')
      .subscribe({ error: () => (failed = true) });
    expect(failed).toBeTrue();
  });
  it('does not create delayed state when a pending request is cancelled', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    const subscription = mock.requestOtp().subscribe();
    subscription.unsubscribe();
    tick(500);
    expect(mock.hasPendingRequest()).toBeFalse();
  }));
  it('reports an expired-preview error for the reserved expired code', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp().subscribe();
    tick(500);
    let error: unknown;
    mock.verifyOtp(MOCK_EXPIRED_OTP).subscribe({ error: (err) => (error = err) });
    tick(500);
    expect(error).toBeInstanceOf(AuthPreviewError);
    expect((error as AuthPreviewError).reason).toBe('expired');
    // The reserved code must not silently succeed or leave the pending flag lingering forever.
    expect(mock.hasPendingRequest()).toBeTrue();
  }));
  it('reports an invalid-preview error for the reserved invalid code', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp().subscribe();
    tick(500);
    let error: unknown;
    mock.verifyOtp(MOCK_INVALID_OTP).subscribe({ error: (err) => (error = err) });
    tick(500);
    expect(error).toBeInstanceOf(AuthPreviewError);
    expect((error as AuthPreviewError).reason).toBe('invalid');
    expect(mock.hasPendingRequest()).toBeTrue();
  }));
  it('resolves an ordinary/unseen email to CLIENTE (FR-005 default preserved)', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp('someone.new@example.com').subscribe();
    tick(500);
    let result: VerifyOtpResult | undefined;
    mock.verifyOtp('123456').subscribe((res) => (result = res));
    tick(500);
    expect(result).toEqual({ role: 'CLIENTE', email: 'someone.new@example.com' });
  }));
  it('resolves the seeded ASESOR email to ASESOR', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp('asesor.andrea@armakers3d.com').subscribe();
    tick(500);
    let result: VerifyOtpResult | undefined;
    mock.verifyOtp('123456').subscribe((res) => (result = res));
    tick(500);
    expect(result?.role).toBe('ASESOR');
  }));
  it('resolves the seeded ADMINISTRADOR email to ADMINISTRADOR', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp('admin.principal@armakers3d.com').subscribe();
    tick(500);
    let result: VerifyOtpResult | undefined;
    mock.verifyOtp('123456').subscribe((res) => (result = res));
    tick(500);
    expect(result?.role).toBe('ADMINISTRADOR');
  }));
  it('resolves role case-insensitively and keeps working for an in-place resend', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp('ADMIN.PRINCIPAL@armakers3d.com').subscribe();
    tick(500);
    // Resend with no email argument must keep using the previously submitted address.
    mock.requestOtp().subscribe();
    tick(500);
    let result: VerifyOtpResult | undefined;
    mock.verifyOtp('123456').subscribe((res) => (result = res));
    tick(500);
    expect(result?.role).toBe('ADMINISTRADOR');
  }));
  it('clears the retained email on reset, defaulting a subsequent verification to CLIENTE', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    mock.requestOtp('admin.principal@armakers3d.com').subscribe();
    tick(500);
    mock.reset();
    mock.requestOtp().subscribe();
    tick(500);
    let result: VerifyOtpResult | undefined;
    mock.verifyOtp('123456').subscribe((res) => (result = res));
    tick(500);
    expect(result?.role).toBe('CLIENTE');
  }));
});
