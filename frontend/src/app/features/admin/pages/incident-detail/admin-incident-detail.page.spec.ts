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
import { SessionStateService } from '../../../../core/services/session-state.service';
import { AdminIncidentDetailPage } from './admin-incident-detail.page';

function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `AdminIncidentDto` (AdminIncidentController GET /{incidentId}). */
function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: 'INC-0001',
    orderId: 'PED-9001',
    orderSummary: '2 unidades: Llavero',
    description: 'Una pieza llegó con una fisura visible en la base.',
    status: 'ABIERTA',
    priority: 'MEDIA',
    resolution: null,
    reportedAt: '2026-06-10T09:00:00Z',
    updatedAt: '2026-06-10T09:00:00Z',
    resolvedAt: null,
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
    customerPhone: '987654321',
    ...overrides,
  };
}

describe('AdminIncidentDetailPage (GET/PATCH /api/admin/incidents/{id}, POST .../resolution)', () => {
  let fixture: ComponentFixture<AdminIncidentDetailPage>;
  let component: AdminIncidentDetailPage;
  let http: HttpTestingController;
  const url = '/api/admin/incidents/INC-0001';

  function create(role: 'ADMINISTRADOR' | 'ASESOR' | 'CLIENTE' = 'ASESOR') {
    TestBed.configureTestingModule({
      imports: [AdminIncidentDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute('INC-0001') },
      ],
    });
    TestBed.inject(SessionStateService).markAuthenticated(role, 's@x.pe', 2);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  function load(body: object = incident()) {
    http.expectOne(url).flush(body);
    fixture.detectChanges();
  }

  it('renders order association, customer info, status, priority and "sin resolución"', () => {
    create();
    load();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('INC-0001');
    expect(text).toContain('PED-9001');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Abierta');
    expect(text).toContain('Media');
    expect(text).toContain('Sin resolución registrada');
    expect(text).not.toContain('Vista de demostración');
  });

  it('renders an existing resolution and resolved date', () => {
    create();
    load(
      incident({
        status: 'RESUELTA',
        resolution: 'Se reenvió la pieza.',
        resolvedAt: '2026-06-12T16:00:00Z',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Se reenvió la pieza.');
  });

  it('degrades gracefully when the customer name/phone are null', () => {
    create();
    load(incident({ customerName: null, customerPhone: null }));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('ana@example.com');
    expect(text).not.toContain('Nombre');
  });

  it('shows management controls for ADMINISTRADOR and ASESOR, hides them for another role (UX only)', () => {
    create('ADMINISTRADOR');
    load();
    expect(fixture.nativeElement.textContent).toContain('Cambiar estado');
    TestBed.resetTestingModule();
    create('CLIENTE');
    load();
    expect(fixture.nativeElement.textContent).not.toContain('Cambiar estado');
  });

  it('never offers RESUELTA in the status select (only the resolution form can reach it)', () => {
    create();
    load();
    const values = (Array.from(fixture.nativeElement.querySelector('select').options) as HTMLOptionElement[])
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).not.toContain('RESUELTA');
    expect(values).not.toContain('ABIERTA'); // the current one
    expect(values).toContain('EN_REVISION');
  });

  it('PATCHes { status } and shows the returned incident', () => {
    create();
    load();
    component.updateSelectedStatus('EN_REVISION');
    component.submitStatusUpdate();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'EN_REVISION' });
    req.flush(incident({ status: 'EN_REVISION' }));
    fixture.detectChanges();
    expect(component.incident()?.status).toBe('EN_REVISION');
    expect(component.statusSuccess()).toContain('actualizó');
  });

  it('PATCHes { priority } only', () => {
    create();
    load();
    component.updateSelectedPriority('ALTA');
    component.submitPriorityUpdate();
    const req = http.expectOne(url);
    expect(req.request.body).toEqual({ priority: 'ALTA' });
    req.flush(incident({ priority: 'ALTA' }));
    expect(component.incident()?.priority).toBe('ALTA');
  });

  it('explains 409 INVALID_STATUS_TRANSITION without changing the incident', () => {
    create();
    load();
    component.updateSelectedStatus('RECHAZADA');
    component.submitStatusUpdate();
    http
      .expectOne(url)
      .flush(
        { code: 'INVALID_STATUS_TRANSITION', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.statusError()).toContain('no está permitido');
    expect(component.incident()?.status).toBe('ABIERTA');
  });

  it('POSTs the trimmed resolution text and shows RESUELTA', () => {
    create();
    load(incident({ status: 'EN_REVISION' }));
    component.updateResolutionText('  Se coordinó el reenvío.  ');
    component.submitResolution();
    const req = http.expectOne(`${url}/resolution`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resolutionText: 'Se coordinó el reenvío.' });
    req.flush(
      incident({ status: 'RESUELTA', resolution: 'Se coordinó el reenvío.', resolvedAt: '2026-06-12T16:00:00Z' }),
    );
    fixture.detectChanges();
    expect(component.incident()?.status).toBe('RESUELTA');
    expect(fixture.nativeElement.textContent).toContain('Se coordinó el reenvío.');
  });

  it('explains that only an En revisión incident can be resolved (409)', () => {
    create();
    load();
    component.updateResolutionText('texto');
    component.submitResolution();
    http
      .expectOne(`${url}/resolution`)
      .flush(
        { code: 'INVALID_STATUS_TRANSITION', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.resolutionError()).toContain('En revisión');
  });

  it('shows not-found on 404', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Incidencia no encontrada');
  });

  it('shows an error state with a working retry on a server failure', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retry = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    load();
    expect(fixture.nativeElement.textContent).toContain('INC-0001');
  });
});
