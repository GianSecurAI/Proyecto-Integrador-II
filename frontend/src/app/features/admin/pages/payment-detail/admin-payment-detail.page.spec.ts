import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { PaymentDetailDto } from '../../models/admin-payment.model';
import { AdminPaymentsService } from '../../services/admin-payments.service';
import { makeDetail, makePaymentAttempt, PAYMENT_ID } from '../../testing/payment-fixtures';
import { AdminPaymentDetailPage } from './admin-payment-detail.page';

function apiError(status: number, code: string, headers?: HttpHeaders): HttpErrorResponse {
  return new HttpErrorResponse({ status, headers, error: { code, message: 'x', timestamp: 't' } });
}

describe('AdminPaymentDetailPage', () => {
  let get: jasmine.Spy;
  let approve: jasmine.Spy;
  let reject: jasmine.Spy;
  let proofImage: jasmine.Spy;
  let harness: RouterTestingHarness;
  let page: AdminPaymentDetailPage;

  async function setup(detail: () => Observable<PaymentDetailDto> = () => of(makeDetail())) {
    get = jasmine.createSpy('get').and.callFake(detail);
    approve = jasmine.createSpy('approve');
    reject = jasmine.createSpy('reject');
    proofImage = jasmine.createSpy('proofImage').and.returnValue(of(new Blob(['x'], { type: 'image/png' })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:admin-proof');
    spyOn(URL, 'revokeObjectURL');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'admin/payments/:id', component: AdminPaymentDetailPage }]),
        { provide: AdminPaymentsService, useValue: { get, approve, reject, proofImage } },
      ],
    });
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(`/admin/payments/${PAYMENT_ID}`, AdminPaymentDetailPage);
    harness.detectChanges();
  }

  const el = (): HTMLElement => harness.routeNativeElement!;
  const text = (): string => el().textContent ?? '';
  const buttonByText = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === label) as HTMLButtonElement;

  it('shows customer, contact, amount, reference, items and attempts', async () => {
    await setup();
    expect(get).toHaveBeenCalledWith(PAYMENT_ID);
    expect(text()).toContain('AM3D-3F2B8C1E');
    expect(text()).toContain('S/ 87.30');
    expect(text()).toContain('Ana Torres');
    expect(text()).toContain('987654321');
    expect(text()).toContain('Llavero A');
    expect(text()).toContain('AB12CD34');
    expect(text()).toContain('200 KB');
    expect(el().querySelector('[data-testid="duplicate-warning"]')).toBeNull();
  });

  it('shows the duplicate warning banner', async () => {
    await setup(() => of(makeDetail({ duplicateProofWarning: true })));
    expect(el().querySelector('[data-testid="duplicate-warning"]')!.textContent).toContain('Captura repetida');
  });

  it('loads the latest proof through the credentialed blob call and shows it as an object URL', async () => {
    const second = makePaymentAttempt({ attemptId: 'att-2', number: 2 });
    await setup(() => of(makeDetail({ attempts: [makePaymentAttempt(), second] })));
    expect(proofImage).toHaveBeenCalledWith(PAYMENT_ID, 'att-2');
    expect(el().querySelector('app-proof-image img')!.getAttribute('src')).toBe('blob:admin-proof');
    buttonByText('Ver').click();
    harness.detectChanges();
    expect(proofImage).toHaveBeenCalledWith(PAYMENT_ID, makePaymentAttempt().attemptId);
  });

  it('approve needs a confirmation, then shows the resulting order id', async () => {
    await setup();
    approve.and.returnValue(of(makeDetail({ status: 'PAID', orderId: 'PED-000123', paidAt: '2026-10-07T18:00:00Z' })));
    buttonByText('Aprobar pago').click();
    harness.detectChanges();
    expect(approve).not.toHaveBeenCalled();
    expect(el().querySelector('[role="alertdialog"]')).not.toBeNull();
    (el().querySelectorAll('[role="alertdialog"] button')[1] as HTMLButtonElement).click();
    harness.detectChanges();
    expect(approve).toHaveBeenCalledWith(PAYMENT_ID);
    expect(el().querySelector('[role="status"]')!.textContent).toContain('PED-000123');
    expect(buttonByText('Aprobar pago')).toBeUndefined(); // decision panel is gone once PAID
  });

  it('cancelling the confirmation does not approve', async () => {
    await setup();
    buttonByText('Aprobar pago').click();
    harness.detectChanges();
    (el().querySelectorAll('[role="alertdialog"] button')[0] as HTMLButtonElement).click();
    harness.detectChanges();
    expect(approve).not.toHaveBeenCalled();
    expect(el().querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('reject requires a reason of 1..300 characters with a live counter', async () => {
    await setup();
    buttonByText('Rechazar').click();
    harness.detectChanges();
    const submit = buttonByText('Confirmar rechazo');
    expect(submit.disabled).toBeTrue();
    const area: HTMLTextAreaElement = el().querySelector('#reject-reason')!;
    expect(area.getAttribute('maxlength')).toBe('300');
    area.value = '   ';
    area.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(submit.disabled).toBeTrue();
    area.value = 'Monto incorrecto';
    area.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(el().querySelector('#reject-reason-counter')!.textContent).toContain('16 / 300');
    expect(submit.disabled).toBeFalse();
  });

  it('reject posts the reason and renders the rejected state; the reason is shown as text, not HTML', async () => {
    await setup();
    const hostile = '<b onclick="x()">mal</b>';
    reject.and.returnValue(
      of(makeDetail({ status: 'PROOF_REJECTED', attempts: [makePaymentAttempt({ decision: 'REJECTED', rejectionReason: hostile })] })),
    );
    buttonByText('Rechazar').click();
    harness.detectChanges();
    const area: HTMLTextAreaElement = el().querySelector('#reject-reason')!;
    area.value = hostile;
    area.dispatchEvent(new Event('input'));
    harness.detectChanges();
    page.reject();
    harness.detectChanges();
    expect(reject).toHaveBeenCalledWith(PAYMENT_ID, hostile);
    expect(text()).toContain(hostile);
    expect(el().querySelector('b')).toBeNull();
    expect(el().querySelector('#reject-reason')).toBeNull(); // PROOF_REJECTED: no more decisions offered
  });

  it('409 CHECKOUT_STATE_CONFLICT explains and reloads the payment', async () => {
    await setup();
    approve.and.returnValue(throwError(() => apiError(409, 'CHECKOUT_STATE_CONFLICT')));
    page.approve();
    harness.detectChanges();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('cambió de estado');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('429 shows the wait time', async () => {
    await setup();
    approve.and.returnValue(throwError(() => apiError(429, 'RATE_LIMITED', new HttpHeaders({ 'Retry-After': '20' }))));
    page.approve();
    harness.detectChanges();
    expect(page.actionError()).toContain('20 segundos');
  });

  it('does not offer decisions unless the payment is PROOF_SUBMITTED', async () => {
    await setup(() => of(makeDetail({ status: 'PAID', orderId: 'PED-000123' })));
    expect(buttonByText('Aprobar pago')).toBeUndefined();
    expect(buttonByText('Rechazar')).toBeUndefined();
    expect(text()).toContain('PED-000123');
  });

  it('404 shows not-found; other errors offer retry', async () => {
    await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    expect(text()).toContain('Pago no encontrado');
  });

  it('a generic load failure shows an error state', async () => {
    await setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(text()).toContain('No se pudo cargar el pago');
  });
});
