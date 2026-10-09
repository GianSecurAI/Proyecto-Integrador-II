import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminReportsPage } from './admin-reports.page';

/** Shapes copied from backend `OrderReportDto` / `IncidentReportDto` (AdminReportController). */
const ORDER_REPORT = {
  from: '2026-09-07',
  to: '2026-10-06',
  totalOrders: 5,
  standardOrders: 3,
  customOrders: 2,
  byStatus: [
    { status: 'CONFIRMADO', count: 3 },
    { status: 'EN_PRODUCCION', count: 0 },
    { status: 'ENVIADO', count: 0 },
    { status: 'ENTREGADO', count: 1 },
    { status: 'CANCELADO', count: 1 },
  ],
  totalAmount: 400.5,
  standardAmount: 100.5,
  customAmount: 300,
};
const INCIDENT_REPORT = {
  from: '2026-09-07',
  to: '2026-10-06',
  totalIncidents: 4,
  openIncidents: 3,
  resolvedIncidents: 1,
  byStatus: [
    { status: 'ABIERTA', count: 2 },
    { status: 'EN_REVISION', count: 1 },
    { status: 'RESUELTA', count: 1 },
    { status: 'RECHAZADA', count: 0 },
  ],
  byPriority: [
    { priority: 'BAJA', count: 1 },
    { priority: 'MEDIA', count: 2 },
    { priority: 'ALTA', count: 1 },
  ],
};

const QUOTATION_REPORT = {
  from: '2026-09-10',
  to: '2026-10-09',
  totalQuotations: 3,
  byStatus: [
    { status: 'REGISTRADA', count: 1, amount: 50 },
    { status: 'ACEPTADA', count: 2, amount: 300 },
    { status: 'RECHAZADA', count: 0, amount: 0 },
    { status: 'VENCIDA', count: 0, amount: 0 },
  ],
  totalAmount: 350,
  acceptedAmount: 300,
};

describe('AdminReportsPage (GET /api/admin/reports/*)', () => {
  let fixture: ComponentFixture<AdminReportsPage>;
  let component: AdminReportsPage;
  let http: HttpTestingController;
  const ordersReq = () => http.expectOne((r) => r.url === '/api/admin/reports/orders');
  const incidentsReq = () => http.expectOne((r) => r.url === '/api/admin/reports/incidents');
  const quotationsReq = () => http.expectOne((r) => r.url === '/api/admin/reports/quotations');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReportsPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminReportsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('requests both reports with EXPLICIT from/to dates (default: last 30 days)', () => {
    const orders = ordersReq();
    const incidents = incidentsReq();
    const quotations = quotationsReq();
    for (const req of [orders, incidents, quotations]) {
      expect(req.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(req.request.params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(req.request.params.has('status')).toBeFalse();
    }
    const from = Date.parse(orders.request.params.get('from')!);
    const to = Date.parse(orders.request.params.get('to')!);
    expect(Math.round((to - from) / 86_400_000)).toBe(29);
    orders.flush(ORDER_REPORT);
    incidents.flush(INCIDENT_REPORT);
    quotations.flush(QUOTATION_REPORT);
  });

  it('shows the loading state, then renders ONLY what the server returned (no client aggregation)', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    ordersReq().flush(ORDER_REPORT);
    incidentsReq().flush(INCIDENT_REPORT);
    quotationsReq().flush(QUOTATION_REPORT);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Total de pedidos');
    expect(text).toContain('S/ 400.50');
    expect(text).toContain('S/ 300.00');
    expect(text).toContain('Cancelado');
    expect(text).toContain('Total de incidencias');
    expect(text).toContain('En revisión');
    expect(text).toContain('Alta');
    expect(text).not.toContain('Vista de demostración');
    expect(fixture.nativeElement.querySelectorAll('app-admin-summary-card').length).toBe(8);
    expect(text).toContain('Total de cotizaciones');
    expect(text).toContain('S/ 300.00');
  });

  it('sends the status filters and the chosen dates when regenerating', () => {
    ordersReq().flush(ORDER_REPORT);
    incidentsReq().flush(INCIDENT_REPORT);
    quotationsReq().flush(QUOTATION_REPORT);
    component.updateStartDate('2026-01-01');
    component.updateEndDate('2026-03-31');
    component.updateOrderStatusFilter('CANCELADO');
    component.updateIncidentStatusFilter('RESUELTA');
    component.generate();
    const orders = ordersReq();
    const incidents = incidentsReq();
    expect(orders.request.params.get('from')).toBe('2026-01-01');
    expect(orders.request.params.get('to')).toBe('2026-03-31');
    expect(orders.request.params.get('status')).toBe('CANCELADO');
    expect(incidents.request.params.get('status')).toBe('RESUELTA');
    orders.flush(ORDER_REPORT);
    incidents.flush(INCIDENT_REPORT);
    quotationsReq().flush(QUOTATION_REPORT);
  });

  it('blocks an inverted or too-long range client-side (UX mirror of the backend 400) and sends nothing', () => {
    ordersReq().flush(ORDER_REPORT);
    incidentsReq().flush(INCIDENT_REPORT);
    quotationsReq().flush(QUOTATION_REPORT);
    component.updateStartDate('2026-05-10');
    component.updateEndDate('2026-05-01');
    expect(component.rangeError()).toContain('no puede ser posterior');
    component.generate();
    http.expectNone((r) => r.url.startsWith('/api/admin/reports'));
    component.updateStartDate('2025-01-01');
    component.updateEndDate('2026-06-01');
    expect(component.rangeError()).toContain('366');
    component.generate();
    http.expectNone((r) => r.url.startsWith('/api/admin/reports'));
  });

  it('shows an error state with retry when the server answers 400/500', () => {
    ordersReq().flush(
      { code: 'VALIDATION_FAILED', message: 'x', timestamp: 't', fieldErrors: [{ field: 'to', message: 'range' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(incidentsReq().cancelled).toBeTrue(); // forkJoin abandons the sibling requests
    expect(quotationsReq().cancelled).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    component.generate();
    ordersReq().flush(ORDER_REPORT);
    incidentsReq().flush(INCIDENT_REPORT);
    quotationsReq().flush(QUOTATION_REPORT);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Total de pedidos');
  });
});
