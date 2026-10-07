import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminIncidentListPage, INCIDENT_SEARCH_DEBOUNCE_MS } from './admin-incident-list.page';

/** Shapes copied from backend `Page<AdminIncidentDto>` (AdminIncidentController list). */
const INCIDENTS = [
  {
    id: 'INC-0001',
    orderId: 'PED-9001',
    orderSummary: 'Set de llaveros',
    description: 'Una pieza llegó con una fisura visible en la base.',
    status: 'ABIERTA',
    priority: 'ALTA',
    resolution: null,
    reportedAt: '2026-06-10T09:00:00Z',
    updatedAt: '2026-06-10T09:00:00Z',
    resolvedAt: null,
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
    customerPhone: null,
  },
  {
    id: 'INC-0002',
    orderId: 'PED-9002',
    orderSummary: 'Trofeo',
    description: 'No recibo actualizaciones del pedido.',
    status: 'EN_REVISION',
    priority: 'MEDIA',
    resolution: null,
    reportedAt: '2026-06-11T09:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
    resolvedAt: null,
    customerEmail: 'carlos@example.com',
    customerName: null,
    customerPhone: null,
  },
];

function page(content: object[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('AdminIncidentListPage (GET /api/admin/incidents, server-side filters)', () => {
  let fixture: ComponentFixture<AdminIncidentListPage>;
  let component: AdminIncidentListPage;
  let http: HttpTestingController;
  const listReq = () => http.expectOne((r) => r.url === '/api/admin/incidents');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminIncidentListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminIncidentListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows loading then the server incidents with status and priority badges and customer', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    listReq().flush(page(INCIDENTS));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('ana@example.com');
    expect(text).toContain('En revisión');
    expect(text).toContain('Alta');
    expect(text).not.toContain('Vista de demostración');
  });

  it('shows the friendly empty state when unfiltered and empty', () => {
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay incidencias');
  });

  it('keeps the filters visible and shows a no-match state when filters return nothing', () => {
    listReq().flush(page(INCIDENTS));
    component.updatePriorityFilter('BAJA');
    const req = listReq();
    expect(req.request.params.get('priority')).toBe('BAJA');
    req.flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ninguna incidencia coincide');
    expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
  });

  it('sends status to the server', () => {
    listReq().flush(page(INCIDENTS));
    component.updateStatusFilter('RECHAZADA');
    const req = listReq();
    expect(req.request.params.get('status')).toBe('RECHAZADA');
    req.flush(page([]));
  });

  it('debounces search and sends q', fakeAsync(() => {
    listReq().flush(page(INCIDENTS));
    component.updateSearch('fisura');
    http.expectNone((r) => r.url === '/api/admin/incidents');
    tick(INCIDENT_SEARCH_DEBOUNCE_MS);
    const req = listReq();
    expect(req.request.params.get('q')).toBe('fisura');
    req.flush(page([INCIDENTS[0]]));
  }));

  it('pages through server pages', () => {
    listReq().flush(page(INCIDENTS, 2));
    component.goToPage(1);
    const req = listReq();
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page(INCIDENTS, 2));
  });

  it('shows an error state with a working retry', () => {
    listReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    fixture.nativeElement.querySelector('app-error-state button').click();
    listReq().flush(page(INCIDENTS));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });
});
