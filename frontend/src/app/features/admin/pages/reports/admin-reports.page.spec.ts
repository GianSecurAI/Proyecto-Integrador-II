import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminOrderSummaryViewModel } from '../../models/admin-order.model';
import { AdminIncidentViewModel } from '../../models/admin-incident.model';
import { AdminOrdersMockService } from '../../services/admin-orders-mock.service';
import { AdminIncidentsMockService } from '../../services/admin-incidents-mock.service';
import { AdminReportsPage } from './admin-reports.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-incident-list.page.spec.ts`'s narrow-mocking
 * convention: only exposes `queryParamMap` (this page reacts to `?mockState=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

const ORDERS: AdminOrderSummaryViewModel[] = [
  {
    id: 'PED-A1',
    placedAt: new Date('2026-06-01T10:00:00Z'),
    status: 'confirmado',
    kind: 'estandar',
    summary: 'Set de llaveros',
    customerEmail: 'ana@example.com',
  },
  {
    id: 'PED-A2',
    placedAt: new Date('2026-06-15T10:00:00Z'),
    status: 'entregado',
    kind: 'personalizado',
    summary: 'Trofeo personalizado, cotizado por WhatsApp',
    customerEmail: 'carlos@example.com',
  },
  {
    id: 'PED-A3',
    placedAt: new Date('2026-08-01T10:00:00Z'),
    status: 'cancelado',
    kind: 'estandar',
    summary: 'Maceta geométrica',
    customerEmail: 'maria@example.com',
  },
];

const INCIDENTS: AdminIncidentViewModel[] = [
  {
    id: 'INC-A1',
    orderId: 'PED-A1',
    orderSummary: 'Set de llaveros',
    description: 'Uno de los llaveros llegó roto.',
    status: 'abierta',
    priority: 'baja',
    resolution: null,
    reportedAt: new Date('2026-06-02T09:00:00Z'),
    resolvedAt: null,
    customerEmail: 'ana@example.com',
  },
  {
    id: 'INC-A2',
    orderId: 'PED-A2',
    orderSummary: 'Trofeo personalizado, cotizado por WhatsApp',
    description: 'El color no coincide con la cotización.',
    status: 'resuelta',
    priority: 'alta',
    resolution: 'Se envió un reemplazo.',
    reportedAt: new Date('2026-08-05T09:00:00Z'),
    resolvedAt: new Date('2026-08-06T09:00:00Z'),
    customerEmail: 'carlos@example.com',
  },
];

describe('AdminReportsPage', () => {
  let fixture: ComponentFixture<AdminReportsPage>;
  let component: AdminReportsPage;

  describe('with the real mock services', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminReportsPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminReportsPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ui-state, [role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();

      tick(400);
    }));

    it('renders the seeded orders/incidents once loaded, aggregated into the three sections', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminReportsPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Pedidos');
      expect(text).toContain('Cotizaciones');
      expect(text).toContain('Incidencias');
      expect(text).toContain('Total de pedidos');
      expect(text).toContain('Cotizaciones registradas');
      expect(text).toContain('Total de incidencias');
    }));

    it('renders an empty state in every section for ?mockState=empty', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'empty' }),
      });
      fixture = TestBed.createComponent(AdminReportsPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const emptyStates = fixture.nativeElement.querySelectorAll('app-empty-state');
      expect(emptyStates.length).toBe(3);
      expect(fixture.nativeElement.querySelector('table')).toBeNull();
    }));

    it('renders the error state with a working retry for ?mockState=error', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'error' }),
      });
      fixture = TestBed.createComponent(AdminReportsPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"], app-error-state')).toBeTruthy();

      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Reintentar'))!;
      retryButton.click();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    }));
  });

  describe('filtering (test double services)', () => {
    beforeEach(async () => {
      const ordersService: Partial<AdminOrdersMockService> = {
        getOrders: (): Observable<AdminOrderSummaryViewModel[]> => of([...ORDERS]),
      };
      const incidentsService: Partial<AdminIncidentsMockService> = {
        getIncidents: (): Observable<AdminIncidentViewModel[]> => of([...INCIDENTS]),
      };

      await TestBed.configureTestingModule({
        imports: [AdminReportsPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: AdminOrdersMockService, useValue: ordersService },
          { provide: AdminIncidentsMockService, useValue: incidentsService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminReportsPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('narrows orders/quotations/incidents by a date range that excludes some seeded records', () => {
      component.updateStartDate('2026-06-10');
      component.updateEndDate('2026-06-30');
      fixture.detectChanges();

      // Only PED-A2 (placed 2026-06-15) falls in range; PED-A1 (06-01) and PED-A3 (08-01) do not.
      expect(component.totalOrders()).toBe(1);
      expect(component.quotations().length).toBe(1);
      expect(component.quotations()[0].id).toBe('PED-A2');
      // Neither incident (reported 06-02 / 08-05) falls in this range.
      expect(component.totalIncidents()).toBe(0);
    });

    it('produces the empty state in every section for a date range that excludes every record', () => {
      component.updateStartDate('2027-01-01');
      component.updateEndDate('2027-01-31');
      fixture.detectChanges();

      expect(component.totalOrders()).toBe(0);
      expect(component.quotations().length).toBe(0);
      expect(component.totalIncidents()).toBe(0);

      const emptyStates = fixture.nativeElement.querySelectorAll('app-empty-state');
      expect(emptyStates.length).toBe(3);
    });

    it('narrows the Pedidos and Cotizaciones sections by the shared order-status filter', () => {
      component.updateOrderStatusFilter('cancelado');
      fixture.detectChanges();

      expect(component.totalOrders()).toBe(1);
      expect(component.ordersFiltered()[0].id).toBe('PED-A3');
      // PED-A3 is `estandar`, so no quotation matches a `cancelado` filter.
      expect(component.quotations().length).toBe(0);
    });

    it('narrows the Incidencias section by the incident-status filter', () => {
      component.updateIncidentStatusFilter('resuelta');
      fixture.detectChanges();

      expect(component.totalIncidents()).toBe(1);
      expect(component.incidentsFiltered()[0].id).toBe('INC-A2');
    });

    it('the Cotizaciones section only ever includes `personalizado`-kind orders', () => {
      fixture.detectChanges();

      const ids = component.quotations().map((order) => order.id);
      expect(ids).toEqual(['PED-A2']);
      expect(ids).not.toContain('PED-A1');
      expect(ids).not.toContain('PED-A3');
    });
  });

  it('renders the error state when the initial fetch fails (test double service)', () => {
    const failingOrdersService: Partial<AdminOrdersMockService> = {
      getOrders: (): Observable<AdminOrderSummaryViewModel[]> =>
        throwError(() => new Error('boom')),
    };
    const incidentsService: Partial<AdminIncidentsMockService> = {
      getIncidents: (): Observable<AdminIncidentViewModel[]> => of([]),
    };

    TestBed.configureTestingModule({
      imports: [AdminReportsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: AdminOrdersMockService, useValue: failingOrdersService },
        { provide: AdminIncidentsMockService, useValue: incidentsService },
      ],
    });
    fixture = TestBed.createComponent(AdminReportsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });
});
