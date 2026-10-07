import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeDetail, makeSummary, PAYMENT_ID } from '../testing/payment-fixtures';
import { AdminPaymentsService } from './admin-payments.service';

describe('AdminPaymentsService', () => {
  let service: AdminPaymentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminPaymentsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists with status PROOF_SUBMITTED by default, page 0, size 20', () => {
    let page: unknown;
    service.list().subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url === '/api/admin/payments');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PROOF_SUBMITTED');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    const body = { content: [makeSummary()], page: 0, size: 20, totalElements: 1, totalPages: 1 };
    req.flush(body);
    expect(page).toEqual(body);
  });

  it('passes the chosen status and page', () => {
    service.list({ status: 'PAID', page: 2, size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/admin/payments');
    expect(req.request.params.get('status')).toBe('PAID');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('gets the detail', () => {
    let detail: unknown;
    service.get(PAYMENT_ID).subscribe((d) => (detail = d));
    http.expectOne(`/api/admin/payments/${PAYMENT_ID}`).flush(makeDetail());
    expect((detail as { reference: string }).reference).toBe('AM3D-3F2B8C1E');
  });

  it('approves with an empty POST and returns the resulting order id', () => {
    let orderId: string | null = null;
    service.approve(PAYMENT_ID).subscribe((d) => (orderId = d.orderId));
    const req = http.expectOne(`/api/admin/payments/${PAYMENT_ID}/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(makeDetail({ status: 'PAID', orderId: 'PED-000123' }));
    expect(orderId as string | null).toBe('PED-000123');
  });

  it('rejects with { reason } trimmed', () => {
    service.reject(PAYMENT_ID, '  Monto incorrecto ').subscribe();
    const req = http.expectOne(`/api/admin/payments/${PAYMENT_ID}/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Monto incorrecto' });
    req.flush(makeDetail({ status: 'PROOF_REJECTED' }));
  });

  it('fetches the proof as a blob with credentials', () => {
    service.proofImage(PAYMENT_ID, 'att-1').subscribe();
    const req = http.expectOne(`/api/admin/payments/${PAYMENT_ID}/proof/att-1`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(new Blob(['x'], { type: 'image/png' }));
  });
});
