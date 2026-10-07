import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CustomerInfoStepComponent } from './customer-info-step.component';

describe('CustomerInfoStepComponent', () => {
  let fixture: ComponentFixture<CustomerInfoStepComponent>;
  let component: CustomerInfoStepComponent;
  let checkoutState: CheckoutStateService;

  function setup(): void {
    TestBed.configureTestingModule({ imports: [CustomerInfoStepComponent] });
    fixture = TestBed.createComponent(CustomerInfoStepComponent);
    component = fixture.componentInstance;
    checkoutState = TestBed.inject(CheckoutStateService);
    fixture.detectChanges();
  }

  it('never advances and marks fields touched when required fields are missing', () => {
    setup();
    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));

    component.submit();

    expect(nextEmitted).toBe(false);
    expect(component.fullNameControl.touched).toBe(true);
    expect(checkoutState.customerInfo()).toBeNull();
  });

  it('rejects an invalid phone format and never advances', () => {
    setup();
    component.fullNameControl.setValue('Ana Torres');
    component.phoneControl.setValue('abc');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(false);
  });

  it('saves the typed value into CheckoutStateService and emits "next" once valid', () => {
    setup();
    component.fullNameControl.setValue('Ana Torres');
    component.phoneControl.setValue('987654321');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(true);
    expect(checkoutState.customerInfo()).toEqual({
      fullName: 'Ana Torres',
      phone: '987654321',
    });
  });

  it('shows the account email from the session read-only (not an editable field, not sent)', () => {
    TestBed.configureTestingModule({ imports: [CustomerInfoStepComponent] });
    const session = TestBed.inject(SessionStateService);
    session.markAuthenticated('CLIENTE', 'logged-in@example.com', 4);
    fixture = TestBed.createComponent(CustomerInfoStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('logged-in@example.com');
    expect(fixture.nativeElement.querySelector('input[type="email"]')).toBeNull();
    expect(Object.keys(component.form.controls)).toEqual(['fullName', 'phone']);
  });

  it('mirrors the backend max length for the full name (UX only)', () => {
    setup();
    component.fullNameControl.setValue('x'.repeat(161));
    component.phoneControl.setValue('987654321');
    component.submit();
    expect(component.fullNameControl.errors?.['maxlength']).toBeTruthy();
  });

  it('restores a previously saved value when re-entering this step (state survives forward/backward navigation)', () => {
    TestBed.configureTestingModule({ imports: [CustomerInfoStepComponent] });
    checkoutState = TestBed.inject(CheckoutStateService);
    checkoutState.setCustomerInfo({
      fullName: 'Luis Farfán',
      phone: '912345678',
    });
    fixture = TestBed.createComponent(CustomerInfoStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.fullNameControl.value).toBe('Luis Farfán');
    expect(component.phoneControl.value).toBe('912345678');
  });

  it('saves the current (possibly partial) value before emitting "back"', () => {
    setup();
    component.fullNameControl.setValue('Draft Name');

    let backEmitted = false;
    component.back.subscribe(() => (backEmitted = true));
    component.goBack();

    expect(backEmitted).toBe(true);
    expect(checkoutState.customerInfo()?.fullName).toBe('Draft Name');
  });
});
