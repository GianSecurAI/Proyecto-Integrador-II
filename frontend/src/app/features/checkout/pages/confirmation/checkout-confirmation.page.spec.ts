import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { CartStateService } from '../../../cart/services/cart-state.service';
import { CART_STORAGE_ADAPTER } from '../../../cart/services/cart-storage.adapter';
import { CheckoutDto } from '../../models/checkout.model';
import { CheckoutService } from '../../services/checkout.service';
import { CheckoutStateService } from '../../state/checkout-state.service';
import { CHECKOUT_ID, makeAttempt, makeCheckout } from '../../testing/checkout-fixtures';
import { CHECKOUT_POLL_INTERVAL_MS, CheckoutConfirmationPage } from './checkout-confirmation.page';

function apiError(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message: 'x', timestamp: 't' } });
}

describe('CheckoutConfirmationPage (GET /api/checkout/{id})', () => {
  let get: jasmine.Spy;
  let cancel: jasmine.Spy;
  let cart: CartStateService;
  let checkoutState: CheckoutStateService;

  function open(
    first: () => Observable<CheckoutDto>,
    url = `/pago?checkoutId=${CHECKOUT_ID}`,
  ): { page: CheckoutConfirmationPage; harness: RouterTestingHarness } {
    get = jasmine.createSpy('get').and.callFake(first);
    cancel = jasmine.createSpy('cancel');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'pago', component: CheckoutConfirmationPage }]),
        { provide: CART_STORAGE_ADAPTER, useValue: { load: () => [], save: () => undefined, clear: () => undefined } },
        {
          provide: CheckoutService,
          useValue: { get, cancel, uploadProof: jasmine.createSpy('uploadProof'), proofImage: () => of(new Blob()) },
        },
      ],
    });
    TestBed.inject(SessionStateService).markAuthenticated('CLIENTE', 'ana@example.com', 3);
    cart = TestBed.inject(CartStateService);
    checkoutState = TestBed.inject(CheckoutStateService);
    let harness!: RouterTestingHarness;
    let page!: CheckoutConfirmationPage;
    RouterTestingHarness.create().then((h) => (harness = h));
    tick();
    harness.navigateByUrl(url, CheckoutConfirmationPage).then((p) => (page = p));
    tick();
    harness.detectChanges();
    return { page, harness };
  }

  const text = (harness: RouterTestingHarness): string => harness.routeNativeElement!.textContent ?? '';

  it('AWAITING_PAYMENT_PROOF: shows amount, reference, QR tabs and the upload form; keeps the cart', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout()));
    cart.addItem({ id: 1, title: 'Llavero A', category: 'LLAVERO', subcategory: 'x', price: 43.65 }, 2);
    harness.detectChanges();
    expect(get).toHaveBeenCalledWith(CHECKOUT_ID);
    const el = harness.routeNativeElement!;
    expect(el.querySelector('h1')!.textContent).toContain('Realiza tu pago');
    expect(text(harness)).toContain('S/ 87.30');
    expect(text(harness)).toContain('AM3D-3F2B8C1E');
    expect(el.querySelector('[role="tab"]')).not.toBeNull();
    expect(el.querySelector('#proof-file')).not.toBeNull();
    expect(cart.isEmpty()).toBe(false);
    expect(checkoutState.pendingCheckoutId()).toBe(CHECKOUT_ID);
  }));

  it('without a checkoutId shows a helpful state and does not call the API', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout()), '/pago');
    expect(get).not.toHaveBeenCalled();
    expect(text(harness)).toContain('Falta el pago a consultar');
  }));

  it('404 shows "no encontramos"; other failures offer retry', fakeAsync(() => {
    let attempt = 0;
    const { harness, page } = open(() => {
      attempt++;
      return attempt === 1 ? throwError(() => apiError(404, 'NOT_FOUND')) : throwError(() => apiError(500, 'INTERNAL_ERROR'));
    });
    expect(text(harness)).toContain('No encontramos este pago');
    page.retry();
    tick();
    harness.detectChanges();
    expect(text(harness)).toContain('No se pudo cargar tu pago');
  }));

  it('PROOF_SUBMITTED: "en verificación", manual refresh and polling every 30 s while visible', fakeAsync(() => {
    const { harness, page } = open(() => of(makeCheckout({ status: 'PROOF_SUBMITTED', expiresAt: null, proofStatus: 'PENDING', attempts: [makeAttempt()] })));
    expect(text(harness)).toContain('Comprobante en verificación');
    expect(harness.routeNativeElement!.querySelector('#proof-file')).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);

    page.refresh();
    tick();
    expect(get).toHaveBeenCalledTimes(2);

    tick(CHECKOUT_POLL_INTERVAL_MS);
    expect(get).toHaveBeenCalledTimes(3);

    // A hidden tab does not poll.
    spyOn(page as unknown as { isTabVisible(): boolean }, 'isTabVisible').and.returnValue(false);
    tick(CHECKOUT_POLL_INTERVAL_MS);
    expect(get).toHaveBeenCalledTimes(3);
    discardPeriodicTasks();
  }));

  it('stops polling when destroyed', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout({ status: 'PROOF_SUBMITTED', expiresAt: null })));
    expect(get).toHaveBeenCalledTimes(1);
    harness.fixture.destroy();
    tick(CHECKOUT_POLL_INTERVAL_MS * 3);
    expect(get).toHaveBeenCalledTimes(1);
  }));

  it('stops polling as soon as the status leaves PROOF_SUBMITTED', fakeAsync(() => {
    let call = 0;
    open(() => {
      call++;
      return of(call === 1 ? makeCheckout({ status: 'PROOF_SUBMITTED', expiresAt: null }) : makeCheckout({ status: 'PROOF_REJECTED', expiresAt: null, rejectionReason: 'Monto incorrecto', attemptsRemaining: 4 }));
    });
    tick(CHECKOUT_POLL_INTERVAL_MS);
    expect(get).toHaveBeenCalledTimes(2);
    tick(CHECKOUT_POLL_INTERVAL_MS * 3);
    expect(get).toHaveBeenCalledTimes(2);
  }));

  it('PROOF_REJECTED: shows the reason as plain text, remaining attempts and the re-upload form', fakeAsync(() => {
    const hostile = '<img src=x onerror=alert(1)>Monto incorrecto';
    const { harness } = open(() =>
      of(makeCheckout({ status: 'PROOF_REJECTED', expiresAt: null, rejectionReason: hostile, attemptsRemaining: 3, proofStatus: 'REJECTED', attempts: [makeAttempt({ status: 'REJECTED', rejectionReason: hostile })] })),
    );
    const alert = harness.routeNativeElement!.querySelector('.checkout-confirmation-page__alert')!;
    expect(alert.textContent).toContain(hostile);
    expect(alert.textContent).toContain('Intentos restantes');
    expect(alert.querySelector('img')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('img[src="x"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#proof-file')).not.toBeNull();
  }));

  it('PROOF_REJECTED with no attempts left hides the upload and tells the customer to cancel', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout({ status: 'PROOF_REJECTED', expiresAt: null, rejectionReason: 'x', attemptsRemaining: 0 })));
    expect(harness.routeNativeElement!.querySelector('#proof-file')).toBeNull();
    expect(text(harness)).toContain('Ya usaste todos tus intentos');
  }));

  it('PAID: shows the order id with tracking links, clears the cart ONLY now and forgets the attempt', fakeAsync(() => {
    const { harness, page } = open(() => of(makeCheckout({ status: 'AWAITING_PAYMENT_PROOF' })));
    cart.addItem({ id: 1, title: 'Llavero A', category: 'LLAVERO', subcategory: 'x', price: 43.65 }, 2);
    const resetAttempt = spyOn(checkoutState, 'resetAttempt').and.callThrough();
    get.and.returnValue(of(makeCheckout({ status: 'PAID', orderId: 'PED-000123', expiresAt: null })));
    page.refresh();
    tick();
    harness.detectChanges();
    expect(text(harness)).toContain('¡Pago confirmado!');
    expect(text(harness)).toContain('PED-000123');
    const links: string[] = Array.from(harness.routeNativeElement!.querySelectorAll('a')).map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '');
    expect(links.some((h) => h.startsWith('/track-order') && h.includes('PED-000123'))).toBeTrue();
    expect(links).toContain('/account/orders/PED-000123');
    expect(cart.isEmpty()).toBe(true);
    expect(resetAttempt).toHaveBeenCalled();
    expect(checkoutState.pendingCheckoutId()).toBeNull();
  }));

  it('PAID does not wipe a cart that no longer matches what was paid', fakeAsync(() => {
    const { page } = open(() => of(makeCheckout({ status: 'AWAITING_PAYMENT_PROOF' })));
    cart.addItem({ id: 9, title: 'Otro', category: 'LLAVERO', subcategory: 'x', price: 5 }, 1);
    get.and.returnValue(of(makeCheckout({ status: 'PAID', orderId: 'PED-000123', expiresAt: null })));
    page.refresh();
    tick();
    expect(cart.isEmpty()).toBe(false);
  }));

  it('EXPIRED and CANCELLED explain and offer a new purchase; nothing is cleared', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout({ status: 'EXPIRED', expiresAt: null })));
    cart.addItem({ id: 1, title: 'Llavero A', category: 'LLAVERO', subcategory: 'x', price: 43.65 }, 2);
    expect(text(harness)).toContain('El pago expiró');
    expect(text(harness)).toContain('Iniciar una compra nueva');
    expect(harness.routeNativeElement!.querySelector('#proof-file')).toBeNull();
    expect(harness.routeNativeElement!.textContent).not.toContain('Cancelar este pago');
    expect(cart.isEmpty()).toBe(false);
  }));

  it('cancel asks for confirmation, then POSTs /cancel and renders the CANCELLED result', fakeAsync(() => {
    const { harness, page } = open(() => of(makeCheckout()));
    cancel.and.returnValue(of(makeCheckout({ status: 'CANCELLED', expiresAt: null })));
    page.askCancel();
    harness.detectChanges();
    expect(text(harness)).toContain('¿Seguro que quieres cancelar este pago?');
    expect(cancel).not.toHaveBeenCalled();
    page.confirmCancel();
    tick();
    harness.detectChanges();
    expect(cancel).toHaveBeenCalledWith(CHECKOUT_ID);
    expect(text(harness)).toContain('Pago cancelado');
  }));

  it('a failed cancel shows a message; 409 refreshes the checkout', fakeAsync(() => {
    const { harness, page } = open(() => of(makeCheckout({ status: 'PROOF_SUBMITTED', expiresAt: null })));
    cancel.and.returnValue(throwError(() => apiError(409, 'CHECKOUT_STATE_CONFLICT')));
    page.askCancel();
    page.confirmCancel();
    tick();
    harness.detectChanges();
    expect(page.actionError()).toContain('cambió de estado');
    expect(get.calls.count()).toBe(2);
    discardPeriodicTasks();
  }));

  it('lists the customer proof attempts', fakeAsync(() => {
    const { harness } = open(() => of(makeCheckout({ status: 'PROOF_SUBMITTED', expiresAt: null, attempts: [makeAttempt()] })));
    expect(text(harness)).toContain('Intento 1');
    expect(text(harness)).toContain('Ver comprobante');
    discardPeriodicTasks();
  }));
});
