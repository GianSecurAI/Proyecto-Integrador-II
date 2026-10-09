import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { AdminQuotationDetailPage } from './admin-quotation-detail.page';

function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `QuotationDto`. */
function quotation(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    customerEmail: 'ana@example.com',
    customerName: 'Ana Quispe',
    customerPhone: '987654321',
    description: '50 llaveros con el logo de la empresa',
    agreedAmount: 250,
    status: 'REGISTRADA',
    allowedNextStatuses: ['ACEPTADA', 'RECHAZADA', 'VENCIDA'],
    notes: null,
    registeredAt: '2026-10-08T15:00:00Z',
    updatedAt: '2026-10-08T15:00:00Z',
    orderId: null,
    ...overrides,
  };
}

describe('AdminQuotationDetailPage (GET/PATCH/POST /api/admin/quotations/{id})', () => {
  let fixture: ComponentFixture<AdminQuotationDetailPage>;
  let http: HttpTestingController;

  function create(id = '7') {
    TestBed.configureTestingModule({
      imports: [AdminQuotationDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminQuotationDetailPage);
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  const button = (text: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((b) =>
      b.textContent?.includes(text),
    );

  it('renders the agreed price and offers exactly the statuses the server allows', () => {
    create();
    http.expectOne('/api/admin/quotations/7').flush(quotation());
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Cotización n.° 7');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('S/ 250.00');
    expect(button('Marcar como aceptada')).toBeTruthy();
    expect(button('Marcar como rechazada')).toBeTruthy();
    expect(button('Marcar como vencida')).toBeTruthy();
    expect(button('Generar pedido')).toBeUndefined();
  });

  it('PATCHes the chosen status with the notes and shows the server answer', () => {
    create();
    http.expectOne('/api/admin/quotations/7').flush(quotation());
    fixture.detectChanges();
    const notes: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    notes.value = 'El cliente aceptó por WhatsApp';
    notes.dispatchEvent(new Event('input'));
    button('Marcar como aceptada')!.click();
    const req = http.expectOne('/api/admin/quotations/7/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'ACEPTADA', notes: 'El cliente aceptó por WhatsApp' });
    req.flush(quotation({ status: 'ACEPTADA', allowedNextStatuses: [] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aceptada');
    expect(button('Marcar como aceptada')).toBeUndefined();
  });

  it('only generates the order after the external payment is confirmed (RN08)', () => {
    create();
    http.expectOne('/api/admin/quotations/7').flush(quotation({ status: 'ACEPTADA', allowedNextStatuses: [] }));
    fixture.detectChanges();
    const generate = button('Generar pedido')!;
    expect(generate.disabled).toBeTrue();
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(button('Generar pedido')!.disabled).toBeFalse();
    button('Generar pedido')!.click();
    const req = http.expectOne('/api/admin/quotations/7/order');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ paymentConfirmed: true });
    req.flush(quotation({ status: 'ACEPTADA', allowedNextStatuses: [], orderId: 'PED-000042' }));
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/admin/orders/PED-000042"]');
    expect(link).toBeTruthy();
    expect(button('Generar pedido')).toBeUndefined();
  });

  it('explains a lost race (409) and reloads the quotation', () => {
    create();
    http.expectOne('/api/admin/quotations/7').flush(quotation());
    fixture.detectChanges();
    button('Marcar como rechazada')!.click();
    http
      .expectOne('/api/admin/quotations/7/status')
      .flush(
        { code: 'INVALID_QUOTATION_TRANSITION', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    http.expectOne('/api/admin/quotations/7').flush(quotation({ status: 'ACEPTADA', allowedNextStatuses: [] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('cambió');
  });

  it('shows not-found on 404 and an error state on a server failure', () => {
    create('99');
    http.expectOne('/api/admin/quotations/99').flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No encontramos esta cotización');
  });
});
