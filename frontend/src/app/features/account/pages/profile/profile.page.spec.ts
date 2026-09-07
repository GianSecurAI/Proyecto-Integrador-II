import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CustomerProfileViewModel, EditableCustomerProfileFields } from '../../models/customer-profile.model';
import { CustomerProfileMockService } from '../../services/customer-profile-mock.service';
import { ProfilePage } from './profile.page';

const SEED_PROFILE: CustomerProfileViewModel = {
  email: 'maria.gomez@example.com',
  memberSince: new Date('2025-11-03T14:20:00Z'),
  firstName: 'María',
  lastName: 'Gómez',
  phone: '987 654 321',
};

type MockedService = Pick<CustomerProfileMockService, 'profile'> & {
  load: jasmine.Spy;
  save: jasmine.Spy;
};

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let component: ProfilePage;
  let profileSignal: WritableSignal<CustomerProfileViewModel>;
  let service: MockedService;

  beforeEach(async () => {
    profileSignal = signal(SEED_PROFILE);
    service = {
      profile: profileSignal.asReadonly(),
      load: jasmine.createSpy('load'),
      save: jasmine.createSpy('save'),
    };
    service.load.and.returnValue(of(profileSignal()));

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), { provide: CustomerProfileMockService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the mock profile in view mode, including the read-only email', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('maria.gomez@example.com');
    expect(text).toContain('María');
    expect(text).toContain('Gómez');
    expect(text).toContain('987 654 321');
    expect(fixture.nativeElement.querySelector('input[type="email"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });

  it('pre-fills the form with current values when entering edit mode', () => {
    component.startEditing();
    fixture.detectChanges();
    expect(component.firstNameControl.value).toBe('María');
    expect(component.lastNameControl.value).toBe('Gómez');
    expect(component.phoneControl.value).toBe('987 654 321');
  });

  it('rejects an invalid phone client-side with accessible feedback and never calls save', () => {
    component.startEditing();
    fixture.detectChanges();
    component.phoneControl.setValue('ab');
    component.save();
    fixture.detectChanges();
    expect(service.save).not.toHaveBeenCalled();
    const phoneInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="tel"]');
    expect(phoneInput.getAttribute('aria-invalid')).toBe('true');
    expect(
      fixture.nativeElement.querySelector(`[id="${phoneInput.getAttribute('aria-describedby')}"]`)
        .textContent,
    ).toContain('válido');
  });

  it('shows a submitting state while saving and prevents duplicate submits', () => {
    const pending = new Subject<CustomerProfileViewModel>();
    service.save.and.returnValue(pending);
    component.startEditing();
    fixture.detectChanges();
    component.phoneControl.setValue('999 888 777');
    component.save();
    component.save();
    fixture.detectChanges();
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(component.submitting()).toBeTrue();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });

  it('updates view-mode values and shows an accessible success message after a successful save', () => {
    service.save.and.callFake((changes: EditableCustomerProfileFields) => {
      profileSignal.update((current) => ({ ...current, ...changes }));
      return of(profileSignal());
    });
    component.startEditing();
    fixture.detectChanges();
    component.firstNameControl.setValue('Ana');
    component.lastNameControl.setValue('Ruiz');
    component.phoneControl.setValue('999 888 777');
    component.save();
    fixture.detectChanges();
    expect(component.submitting()).toBeFalse();
    expect(component.editing()).toBeFalse();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Ana');
    expect(text).toContain('Ruiz');
    expect(text).toContain('999 888 777');
    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(status.textContent).toContain('actualizaron');
  });

  it('shows a generic error on a failed save and never leaks the underlying error text', () => {
    service.save.and.returnValue(throwError(() => new Error('Internal DB constraint violated')));
    component.startEditing();
    fixture.detectChanges();
    component.phoneControl.setValue('000-000-000');
    component.save();
    fixture.detectChanges();
    expect(component.errorMessage()).toBe(
      'No pudimos guardar los cambios. Inténtalo de nuevo más tarde.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Internal DB constraint violated');
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('No pudimos guardar');
  });

  it('reverts pending edits without calling save when cancelled', () => {
    component.startEditing();
    fixture.detectChanges();
    component.firstNameControl.setValue('Cambiado');
    component.cancel();
    fixture.detectChanges();
    expect(service.save).not.toHaveBeenCalled();
    expect(component.editing()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('María');
    expect(fixture.nativeElement.textContent).not.toContain('Cambiado');
  });
});
