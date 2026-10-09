import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminQuotationListPage } from './admin-quotation-list.page';

const ROW = {
  id: 7,
  customerEmail: 'ana@example.com',
  customerName: null,
  customerPhone: null,
  description: '50 llaveros con el logo de la empresa',
  agreedAmount: 250,
  status: 'ACEPTADA',
  allowedNextStatuses: [],
  notes: null,
  registeredAt: '2026-10-08T15:00:00Z',
  updatedAt: '2026-10-08T15:00:00Z',
  orderId: 'PED-000042',
};

const page = (content: unknown[], totalPages = 1) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages });

describe('AdminQuotationListPage (GET /api/admin/quotations)', () => {
  let fixture: ComponentFixture<AdminQuotationListPage>;
  let component: AdminQuotationListPage;
  let http: HttpTestingController;
  const list = () => http.expectOne((r) => r.url === '/api/admin/quotations');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminQuotationListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminQuotationListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('lists the quotations the server returned, with their status, amount and generated order', () => {
    list().flush(page([ROW]));
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('ana@example.com');
    expect(text).toContain('S/ 250.00');
    expect(text).toContain('Aceptada');
    expect(fixture.nativeElement.querySelector('a[href="/admin/orders/PED-000042"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/admin/quotations/7"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/admin/quotations/new"]')).toBeTruthy();
  });

  it('shows an empty state when there are none', () => {
    list().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay cotizaciones');
  });

  it('filters by status on the server and goes back to the first page', () => {
    list().flush(page([ROW]));
    component.updateStatusFilter('REGISTRADA');
    const req = list();
    expect(req.request.params.get('status')).toBe('REGISTRADA');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ninguna cotización coincide con los filtros');
  });

  it('shows an error state with a working retry', () => {
    list().flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    component.retry();
    list().flush(page([ROW]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
  });
});
