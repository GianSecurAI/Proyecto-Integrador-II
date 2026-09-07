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

  it('rejects an invalid email format and never advances', () => {
    setup();
    component.fullNameControl.setValue('Ana Torres');
    component.emailControl.setValue('not-an-email');
    component.phoneControl.setValue('987654321');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(false);
  });

  it('rejects an invalid phone format and never advances', () => {
    setup();
    component.fullNameControl.setValue('Ana Torres');
    component.emailControl.setValue('ana@example.com');
    component.phoneControl.setValue('abc');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(false);
  });

  it('saves the typed value into CheckoutStateService and emits "next" once valid', () => {
    setup();
    component.fullNameControl.setValue('Ana Torres');
    component.emailControl.setValue('ana@example.com');
    component.phoneControl.setValue('987654321');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(true);
    expect(checkoutState.customerInfo()).toEqual({
      fullName: 'Ana Torres',
      email: 'ana@example.com',
      phone: '987654321',
    });
  });

  it('pre-fills the email from the current session but keeps it editable', () => {
    TestBed.configureTestingModule({ imports: [CustomerInfoStepComponent] });
    const session = TestBed.inject(SessionStateService);
    session.markAuthenticated('CLIENTE', 'logged-in@example.com');
    fixture = TestBed.createComponent(CustomerInfoStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.emailControl.value).toBe('logged-in@example.com');
    expect(component.emailControl.disabled).toBe(false);

    component.emailControl.setValue('changed@example.com');
    expect(component.emailControl.value).toBe('changed@example.com');
  });

  it('restores a previously saved value when re-entering this step (state survives forward/backward navigation)', () => {
    TestBed.configureTestingModule({ imports: [CustomerInfoStepComponent] });
    checkoutState = TestBed.inject(CheckoutStateService);
    checkoutState.setCustomerInfo({
      fullName: 'Luis Farfán',
      email: 'luis@example.com',
      phone: '912345678',
    });
    fixture = TestBed.createComponent(CustomerInfoStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.fullNameControl.value).toBe('Luis Farfán');
    expect(component.emailControl.value).toBe('luis@example.com');
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
