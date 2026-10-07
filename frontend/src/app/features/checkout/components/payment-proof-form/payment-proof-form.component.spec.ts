import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CheckoutDto } from '../../models/checkout.model';
import { CheckoutService } from '../../services/checkout.service';
import { makeCheckout, makeFile } from '../../testing/checkout-fixtures';
import { PAYMENT_QR_IMAGES, PaymentProofFormComponent } from './payment-proof-form.component';

function apiError(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message: 'x', timestamp: 't' } });
}

describe('PaymentProofFormComponent', () => {
  let fixture: ComponentFixture<PaymentProofFormComponent>;
  let component: PaymentProofFormComponent;
  let uploadProof: jasmine.Spy;
  let createUrl: jasmine.Spy;
  let revokeUrl: jasmine.Spy;

  function setup(result: () => Observable<CheckoutDto> = () => of(makeCheckout({ status: 'PROOF_SUBMITTED' }))) {
    uploadProof = jasmine.createSpy('uploadProof').and.callFake(result);
    createUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:preview-1');
    revokeUrl = spyOn(URL, 'revokeObjectURL');
    TestBed.configureTestingModule({
      imports: [PaymentProofFormComponent],
      providers: [{ provide: CheckoutService, useValue: { uploadProof } }],
    });
    fixture = TestBed.createComponent(PaymentProofFormComponent);
    fixture.componentRef.setInput('checkout', makeCheckout());
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function chooseFile(file: File): HTMLInputElement {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#proof-file');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return input;
  }

  function submitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[type="submit"]');
  }

  it('shows the server amount, the reference, instructions in Spanish and the Yape QR first', () => {
    setup();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('S/ 87.30');
    expect(text).toContain('AM3D-3F2B8C1E');
    expect(text).toContain('escanea el código QR');
    const qr: HTMLImageElement = fixture.nativeElement.querySelector('.proof-form__qr');
    expect(qr.getAttribute('src')).toBe(PAYMENT_QR_IMAGES.YAPE);
    expect(qr.alt).toContain('Yape');
  });

  it('switches to the Plin tab with its own QR and uses that method on submit', () => {
    setup();
    const tabs: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    expect(tabs.map((t) => t.textContent!.trim())).toEqual(['Yape', 'Plin']);
    tabs[1].click();
    fixture.detectChanges();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.querySelector('.proof-form__qr').getAttribute('src')).toBe(PAYMENT_QR_IMAGES.PLIN);

    chooseFile(makeFile('p.png', 'image/png'));
    component.submit();
    expect(uploadProof.calls.mostRecent().args[2]).toBe('PLIN');
  });

  it('keeps submit disabled without a file and enables it with a valid one, previewing via object URL', () => {
    setup();
    expect(submitButton().disabled).toBeTrue();
    chooseFile(makeFile('p.png', 'image/png'));
    expect(createUrl).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.proof-form__preview img').getAttribute('src')).toBe('blob:preview-1');
    expect(submitButton().disabled).toBeFalse();
  });

  it('rejects a wrong type or an oversized file client-side without calling the API', () => {
    setup();
    chooseFile(makeFile('x.gif', 'image/gif'));
    expect(fixture.nativeElement.querySelector('#proof-file-error').textContent).toContain('JPG, PNG o WebP');
    expect(submitButton().disabled).toBeTrue();
    expect(createUrl).not.toHaveBeenCalled();

    chooseFile(makeFile('big.png', 'image/png', 5 * 1024 * 1024 + 1));
    expect(fixture.nativeElement.querySelector('#proof-file-error').textContent).toContain('5 MB');
    component.submit();
    expect(uploadProof).not.toHaveBeenCalled();
  });

  it('validates the optional operation code and blocks submit while it is malformed', () => {
    setup();
    chooseFile(makeFile());
    const code: HTMLInputElement = fixture.nativeElement.querySelector('#proof-operation-code');
    code.value = 'AB1';
    code.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#proof-code-error')).not.toBeNull();
    expect(submitButton().disabled).toBeTrue();

    code.value = 'AB12CD34';
    code.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#proof-code-error')).toBeNull();
    expect(submitButton().disabled).toBeFalse();
  });

  it('uploads file, method and code, emits the server checkout and revokes the preview', () => {
    const updated = makeCheckout({ status: 'PROOF_SUBMITTED' });
    setup(() => of(updated));
    const emitted: CheckoutDto[] = [];
    component.uploaded.subscribe((c) => emitted.push(c));
    const file = makeFile('p.png', 'image/png');
    chooseFile(file);
    const code: HTMLInputElement = fixture.nativeElement.querySelector('#proof-operation-code');
    code.value = 'AB12CD34';
    code.dispatchEvent(new Event('input'));

    component.submit();

    expect(uploadProof).toHaveBeenCalledWith(makeCheckout().checkoutId, file, 'YAPE', 'AB12CD34');
    expect(emitted).toEqual([updated]);
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
    expect(component.uploading()).toBeFalse();
  });

  it('is disabled while uploading and ignores a second submit', () => {
    const pending = new Subject<CheckoutDto>();
    setup(() => pending);
    chooseFile(makeFile());
    component.submit();
    component.submit();
    fixture.detectChanges();
    expect(uploadProof).toHaveBeenCalledTimes(1);
    expect(component.uploading()).toBeTrue();
    expect(submitButton().disabled).toBeTrue();
    expect((fixture.nativeElement.querySelector('#proof-file') as HTMLInputElement).disabled).toBeTrue();
  });

  it('maps server errors to friendly messages and asks the page to refresh on a state conflict', () => {
    setup(() => throwError(() => apiError(415, 'UNSUPPORTED_IMAGE_TYPE')));
    chooseFile(makeFile());
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Formato no admitido');
    expect(component.uploading()).toBeFalse();
  });

  it('emits stale on 409 CHECKOUT_STATE_CONFLICT', () => {
    setup(() => throwError(() => apiError(409, 'CHECKOUT_STATE_CONFLICT')));
    let stale = 0;
    component.stale.subscribe(() => stale++);
    chooseFile(makeFile());
    component.submit();
    expect(stale).toBe(1);
    expect(component.errorMessage()).toContain('cambió de estado');
  });

  it('revokes the object URL when destroyed', () => {
    setup();
    chooseFile(makeFile());
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview-1');
  });

  it('never renders a phone number it was not configured with (no invented account data)', () => {
    setup();
    expect(fixture.nativeElement.querySelector('.proof-form__account')).toBeNull();
  });
});
