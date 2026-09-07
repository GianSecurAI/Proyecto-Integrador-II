import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { DeliveryInfoStepComponent } from './delivery-info-step.component';

describe('DeliveryInfoStepComponent', () => {
  let fixture: ComponentFixture<DeliveryInfoStepComponent>;
  let component: DeliveryInfoStepComponent;
  let checkoutState: CheckoutStateService;

  function setup(): void {
    TestBed.configureTestingModule({ imports: [DeliveryInfoStepComponent] });
    fixture = TestBed.createComponent(DeliveryInfoStepComponent);
    component = fixture.componentInstance;
    checkoutState = TestBed.inject(CheckoutStateService);
    fixture.detectChanges();
  }

  it('never advances and marks fields touched when required fields (address/district) are missing', () => {
    setup();
    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));

    component.submit();

    expect(nextEmitted).toBe(false);
    expect(component.addressControl.touched).toBe(true);
    expect(component.districtControl.touched).toBe(true);
    expect(checkoutState.deliveryInfo()).toBeNull();
  });

  it('accepts a valid submission with optional notes left blank, saving it and emitting "next"', () => {
    setup();
    component.addressControl.setValue('Av. Los Álamos 123');
    component.districtControl.setValue('Miraflores');

    let nextEmitted = false;
    component.next.subscribe(() => (nextEmitted = true));
    component.submit();

    expect(nextEmitted).toBe(true);
    expect(checkoutState.deliveryInfo()).toEqual({
      address: 'Av. Los Álamos 123',
      district: 'Miraflores',
      notes: '',
    });
  });

  it('restores a previously saved value when re-entering this step', () => {
    TestBed.configureTestingModule({ imports: [DeliveryInfoStepComponent] });
    checkoutState = TestBed.inject(CheckoutStateService);
    checkoutState.setDeliveryInfo({
      address: 'Calle Real 45',
      district: 'San Isidro',
      notes: 'Casa azul',
    });
    fixture = TestBed.createComponent(DeliveryInfoStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.addressControl.value).toBe('Calle Real 45');
    expect(component.districtControl.value).toBe('San Isidro');
    expect(component.notesControl.value).toBe('Casa azul');
  });

  it('documents the deterministic failure-preview trigger on screen', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('__mock_fail__');
  });

  it('saves the current (possibly partial) value before emitting "back"', () => {
    setup();
    component.addressControl.setValue('Draft address');

    let backEmitted = false;
    component.back.subscribe(() => (backEmitted = true));
    component.goBack();

    expect(backEmitted).toBe(true);
    expect(checkoutState.deliveryInfo()?.address).toBe('Draft address');
  });
});
