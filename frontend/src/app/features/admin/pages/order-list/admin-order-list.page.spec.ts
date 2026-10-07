import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminOrderListPage, ORDER_SEARCH_DEBOUNCE_MS } from './admin-order-list.page';

/** Shapes copied from backend `Page<AdminOrderSummaryDto>` (AdminOrderController list). */
const ORDERS = [
  {
    id: 'PED-9001',
    placedAt: '2026-06-01T10:00:00Z',
    status: 'PENDIENTE',
    kind: 'ESTANDAR',
    summary: 'Set de llaveros',
    totalAmount: 25,
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
    customerPhone: '987654321',
  },
  {
    id: 'PED-9002',
    placedAt: '2026-06-02T10:00:00Z',
    status: 'CONFIRMADO',
    kind: 'PERSONALIZADO',
    summary: 'Trofeo personalizado',
    totalAmount: 180,
    customerEmail: 'carlos@example.com',
    customerName: null,
    customerPhone: null,
  },
];

function page(content: object[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('AdminOrderListPage (GET /api/admin/orders, server-side filters)', () => {
  let fixture: ComponentFixture<AdminOrderListPage>;
  let component: AdminOrderListPage;
  let http: HttpTestingController;
  const listReq = () => http.expectOne((r) => r.url === '/api/admin/orders');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrderListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function create(): void {
    fixture = TestBed.createComponent(AdminOrderListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows loading, then renders server orders with customer, kind label, total and status badge', () => {
    create();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    const req = listReq();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.has('status')).toBeFalse();
    req.flush(page(ORDERS));
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Personalizado');
    expect(text).toContain('S/ 180.00');
    expect(text).toContain('Confirmado');
    expect(text).not.toContain('Vista de demostración');
  });

  it('shows the "no orders yet" empty state with the register CTA when unfiltered and empty', () => {
    create();
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay pedidos');
    expect(fixture.nativeElement.querySelector('app-empty-state a')?.getAttribute('href')).toBe(
      '/admin/orders/register-personalized',
    );
  });

  it('shows a different empty state when filters match nothing', () => {
    create();
    listReq().flush(page(ORDERS));
    fixture.detectChanges();
    component.updateStatusFilter('CANCELADO');
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ningún pedido coincide');
  });

  it('sends status, kind and date range to the server as query params', () => {
    create();
    listReq().flush(page(ORDERS));
    component.updateStatusFilter('EN_PRODUCCION');
    const byStatus = listReq();
    expect(byStatus.request.params.get('status')).toBe('EN_PRODUCCION');
    byStatus.flush(page(ORDERS));
    component.updateKindFilter('PERSONALIZADO');
    const byKind = listReq();
    expect(byKind.request.params.get('kind')).toBe('PERSONALIZADO');
    expect(byKind.request.params.get('status')).toBe('EN_PRODUCCION');
    byKind.flush(page(ORDERS));
    component.updateFromDate('2026-06-01');
    listReq().flush(page(ORDERS));
    component.updateToDate('2026-06-30');
    const ranged = listReq();
    expect(ranged.request.params.get('from')).toBe('2026-06-01');
    expect(ranged.request.params.get('to')).toBe('2026-06-30');
    ranged.flush(page(ORDERS));
  });

  it('debounces the text search and sends it as q', fakeAsync(() => {
    create();
    listReq().flush(page(ORDERS));
    component.updateSearch('ana@');
    http.expectNone((r) => r.url === '/api/admin/orders');
    tick(ORDER_SEARCH_DEBOUNCE_MS);
    const req = listReq();
    expect(req.request.params.get('q')).toBe('ana@');
    req.flush(page([ORDERS[0]]));
  }));

  it('pages through server pages', () => {
    create();
    listReq().flush(page(ORDERS, 3));
    fixture.detectChanges();
    component.goToPage(2);
    const req = listReq();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(page(ORDERS, 3));
  });

  it('shows an error state with a working retry', () => {
    create();
    listReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    fixture.nativeElement.querySelector('app-error-state button').click();
    listReq().flush(page(ORDERS));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });
});
