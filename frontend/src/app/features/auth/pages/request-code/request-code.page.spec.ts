import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_PREVIEW, AuthPreview } from '../../services/auth-preview.service';
import { RequestCodePage } from './request-code.page';

describe('RequestCodePage', () => {
  let fixture: ComponentFixture<RequestCodePage>;
  let component: RequestCodePage;
  let auth: jasmine.SpyObj<AuthPreview>;
  let router: Router;
  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthPreview>('AuthPreview', [
      'requestOtp',
      'verifyOtp',
      'reset',
      'hasPendingRequest',
    ]);
    auth.requestOtp.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [RequestCodePage],
      providers: [provideRouter([]), { provide: AUTH_PREVIEW, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestCodePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });
  it('uses shared controls with accessible email labeling and no password', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('email');
    expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-button button[type="submit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });
  it('shows an associated validation error and does not request invalid email', () => {
    component.emailControl.setValue('invalid');
    component.submit();
    fixture.detectChanges();
    expect(auth.requestOtp).not.toHaveBeenCalled();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      fixture.nativeElement.querySelector(`[id="${input.getAttribute('aria-describedby')}"]`)
        .textContent,
    ).toContain('válido');
  });
  it('trims email, navigates without sensitive state and clears the form', () => {
    component.emailControl.setValue('  customer@example.com  ');
    component.submit();
    expect(auth.requestOtp).toHaveBeenCalledWith('customer@example.com');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-code']);
    expect(component.emailControl.value).toBe('');
  });
  it('shows loading and prevents duplicate submits', () => {
    auth.requestOtp.and.returnValue(new Subject<void>());
    component.emailControl.setValue('customer@example.com');
    component.submit();
    component.submit();
    fixture.detectChanges();
    expect(auth.requestOtp).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    expect(component.submitting()).toBeTrue();
  });
  it('never displays error details that could disclose account existence', () => {
    auth.requestOtp.and.returnValue(throwError(() => new Error('Account does not exist')));
    component.emailControl.setValue('customer@example.com');
    component.submit();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe('No pudimos continuar. Inténtalo de nuevo más tarde.');
    expect(component.submitting()).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Account does not exist');
  });
  it('cancels pending behavior and clears email when leaving the screen', () => {
    const pending = new Subject<void>();
    auth.requestOtp.and.returnValue(pending);
    component.emailControl.setValue('customer@example.com');
    component.submit();
    fixture.destroy();
    pending.next();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.emailControl.value).toBe('');
  });
});
