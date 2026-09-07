import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { AdminIncidentViewModel } from '../../models/admin-incident.model';
import { AdminIncidentsMockService } from '../../services/admin-incidents-mock.service';
import { AdminIncidentDetailPage } from './admin-incident-detail.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-order-detail.page.spec.ts`'s
 * narrow-mocking convention. */
function fakeActivatedRoute(
  id: string,
  queryParams: Record<string, string> = {},
): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  const query: ParamMap = convertToParamMap(queryParams);
  return {
    paramMap: of(params),
    queryParamMap: of(query),
    snapshot: { paramMap: params, queryParamMap: query } as ActivatedRouteSnapshot,
  };
}

function configure(
  id: string,
  queryParams: Record<string, string> = {},
  extraProviders: unknown[] = [],
) {
  TestBed.configureTestingModule({
    imports: [AdminIncidentDetailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: fakeActivatedRoute(id, queryParams) },
      ...(extraProviders as never[]),
    ],
  });
}

describe('AdminIncidentDetailPage', () => {
  let fixture: ComponentFixture<AdminIncidentDetailPage>;

  it('renders order association, customer info, status, priority and existing resolution', fakeAsync(() => {
    configure('INC-ADM-0001');
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('INC-ADM-0001');
    expect(text).toContain('PED-3001');
    expect(text).toContain('ana.rojas@example.com');
    expect(text).toContain('Ana Rojas');
    expect(text).toContain('Resuelta');
    expect(text).toContain('Media');
    expect(text).toContain('Se coordinó el reenvío');
  }));

  it('renders the "sin resolución" state when no resolution has been registered yet', fakeAsync(() => {
    configure('INC-ADM-0003');
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin resolución registrada');
  }));

  it('degrades gracefully when the customer name/phone are absent', fakeAsync(() => {
    configure('INC-ADM-0004'); // PED-3005 — no name/phone on file
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('diego.torres@example.com');
    const orderTerms: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-incident-detail-page__order dt'),
    );
    // Only "Pedido asociado" + "Correo del cliente" — no name/phone terms.
    expect(orderTerms.length).toBe(2);
  }));

  it('shows the management controls for an ADMINISTRADOR session', fakeAsync(() => {
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('ADMINISTRADOR');
    configure('INC-ADM-0003', {}, [{ provide: SessionStateService, useValue: sessionState }]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('form').length).toBe(3);
  }));

  it('shows the management controls for an ASESOR session', fakeAsync(() => {
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('ASESOR');
    configure('INC-ADM-0003', {}, [{ provide: SessionStateService, useValue: sessionState }]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('form').length).toBe(3);
  }));

  it('hides the management controls when the session role is not ADMINISTRADOR/ASESOR — component-level check, independent of routing (real enforcement is server-side)', fakeAsync(() => {
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('CLIENTE');
    configure('INC-ADM-0003', {}, [{ provide: SessionStateService, useValue: sessionState }]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('form').length).toBe(0);
    // The resolution/status/priority are still visible read-only, just not editable.
    expect(fixture.nativeElement.textContent).toContain('Sin resolución registrada');
  }));

  it('calls updateStatus with the chosen status and updates the displayed badge without a reload (test double service)', fakeAsync(() => {
    const seeded: AdminIncidentViewModel = {
      id: 'INC-X',
      orderId: 'PED-X',
      orderSummary: 'Pedido de prueba',
      description: 'Descripción de prueba',
      status: 'abierta',
      priority: 'baja',
      resolution: null,
      reportedAt: new Date('2026-01-01T00:00:00Z'),
      resolvedAt: null,
      customerEmail: 'test@example.com',
    };
    const service: Partial<AdminIncidentsMockService> & { updateStatus: jasmine.Spy } = {
      getIncidentById: () => of(seeded),
      updateStatus: jasmine
        .createSpy('updateStatus')
        .and.returnValue(of({ ...seeded, status: 'en_revision' })),
    };
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('ADMINISTRADOR');
    configure('INC-X', {}, [
      { provide: AdminIncidentsMockService, useValue: service },
      { provide: SessionStateService, useValue: sessionState },
    ]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.updateSelectedStatus('en_revision');
    fixture.detectChanges();
    component.submitStatusUpdate();
    fixture.detectChanges();

    expect(service.updateStatus).toHaveBeenCalledOnceWith('INC-X', 'en_revision');
    expect(fixture.nativeElement.textContent).toContain('En revisión');
  }));

  it('calls updatePriority with the chosen priority (test double service)', fakeAsync(() => {
    const seeded: AdminIncidentViewModel = {
      id: 'INC-X',
      orderId: 'PED-X',
      orderSummary: 'Pedido de prueba',
      description: 'Descripción de prueba',
      status: 'abierta',
      priority: 'baja',
      resolution: null,
      reportedAt: new Date('2026-01-01T00:00:00Z'),
      resolvedAt: null,
      customerEmail: 'test@example.com',
    };
    const service: Partial<AdminIncidentsMockService> & { updatePriority: jasmine.Spy } = {
      getIncidentById: () => of(seeded),
      updatePriority: jasmine
        .createSpy('updatePriority')
        .and.returnValue(of({ ...seeded, priority: 'alta' })),
    };
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('ADMINISTRADOR');
    configure('INC-X', {}, [
      { provide: AdminIncidentsMockService, useValue: service },
      { provide: SessionStateService, useValue: sessionState },
    ]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.updateSelectedPriority('alta');
    fixture.detectChanges();
    component.submitPriorityUpdate();
    fixture.detectChanges();

    expect(service.updatePriority).toHaveBeenCalledOnceWith('INC-X', 'alta');
    expect(fixture.nativeElement.textContent).toContain('Alta');
  }));

  it('calls registerResolution and updates the displayed resolution/status without a page reload (test double service)', fakeAsync(() => {
    const seeded: AdminIncidentViewModel = {
      id: 'INC-X',
      orderId: 'PED-X',
      orderSummary: 'Pedido de prueba',
      description: 'Descripción de prueba',
      status: 'en_revision',
      priority: 'media',
      resolution: null,
      reportedAt: new Date('2026-01-01T00:00:00Z'),
      resolvedAt: null,
      customerEmail: 'test@example.com',
    };
    const resolvedAt = new Date('2026-02-01T00:00:00Z');
    const service: Partial<AdminIncidentsMockService> & { registerResolution: jasmine.Spy } = {
      getIncidentById: () => of(seeded),
      registerResolution: jasmine.createSpy('registerResolution').and.returnValue(
        of({
          ...seeded,
          resolution: 'Se envió una pieza de reemplazo.',
          status: 'resuelta',
          resolvedAt,
        }),
      ),
    };
    const sessionState = new SessionStateService();
    sessionState.markAuthenticated('ASESOR');
    configure('INC-X', {}, [
      { provide: AdminIncidentsMockService, useValue: service },
      { provide: SessionStateService, useValue: sessionState },
    ]);
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.updateResolutionText('Se envió una pieza de reemplazo.');
    fixture.detectChanges();
    component.submitResolution();
    tick(500);
    fixture.detectChanges();

    expect(service.registerResolution).toHaveBeenCalledOnceWith(
      'INC-X',
      'Se envió una pieza de reemplazo.',
    );
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Se envió una pieza de reemplazo.');
    expect(text).toContain('Resuelta');
    expect(text).not.toContain('Sin resolución registrada');
  }));

  it('shows a not-found state for an unknown incident id (real state, not simulated)', fakeAsync(() => {
    configure('no-existe');
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Incidencia no encontrada');
  }));

  it('shows the error state with a working retry for ?mockState=error', fakeAsync(() => {
    configure('INC-ADM-0001', { mockState: 'error' });
    fixture = TestBed.createComponent(AdminIncidentDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const retryButton = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Reintentar'))!;
    retryButton.click();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  }));
});
