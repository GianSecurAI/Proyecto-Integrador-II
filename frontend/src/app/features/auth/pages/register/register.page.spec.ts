import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AUTH_PREVIEW, AuthPreview } from '../../services/auth-preview.service';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let component: RegisterPage;
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
      imports: [RegisterPage],
      providers: [provideRouter([]), { provide: AUTH_PREVIEW, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });
  it('uses shared controls with accessible labeling and no password field', () => {
    const inputs: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input'));
    expect(inputs.length).toBe(4);
    for (const input of inputs) {
      expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)).toBeTruthy();
    }
    expect(fixture.nativeElement.querySelector('app-button button[type="submit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });
  it('submits with only a valid email and navigates to verify-code', () => {
    component.emailControl.setValue('customer@example.com');
    component.submit();
    expect(auth.requestOtp).toHaveBeenCalledWith('customer@example.com');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-code']);
  });
  it('submits identically when all optional fields are also filled (FR-004 anti-enumeration)', () => {
    component.emailControl.setValue('customer@example.com');
    component.firstNameControl.setValue('María');
    component.lastNameControl.setValue('Gómez');
    component.phoneControl.setValue('987 654 321');
    component.submit();
    expect(auth.requestOtp).toHaveBeenCalledOnceWith('customer@example.com');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-code']);
  });
  it('rejects a missing/invalid email client-side and never calls requestOtp', () => {
    component.emailControl.setValue('invalid');
    component.submit();
    fixture.detectChanges();
    expect(auth.requestOtp).not.toHaveBeenCalled();
    const emailInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="email"]');
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
    expect(
      fixture.nativeElement.querySelector(
        `[id="${emailInput.getAttribute('aria-describedby')}"]`,
      ).textContent,
    ).toContain('válido');
  });
  it('shows loading state and prevents duplicate submits', () => {
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
});
