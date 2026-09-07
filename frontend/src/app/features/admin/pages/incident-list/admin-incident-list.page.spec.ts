import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminIncidentViewModel } from '../../models/admin-incident.model';
import { AdminIncidentsMockService } from '../../services/admin-incidents-mock.service';
import { AdminIncidentListPage } from './admin-incident-list.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-order-list.page.spec.ts`'s narrow-mocking
 * convention: only exposes `queryParamMap` (this page reacts to `?mockState=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

const INCIDENTS: AdminIncidentViewModel[] = [
  {
    id: 'INC-9001',
    orderId: 'PED-9001',
    orderSummary: 'Set de llaveros',
    description: 'Uno de los llaveros llegó roto.',
    status: 'abierta',
    priority: 'baja',
    resolution: null,
    reportedAt: new Date('2026-06-01T10:00:00Z'),
    resolvedAt: null,
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
  },
  {
    id: 'INC-9002',
    orderId: 'PED-9002',
    orderSummary: 'Trofeo personalizado',
    description: 'El color no coincide con la cotización.',
    status: 'en_revision',
    priority: 'alta',
    resolution: null,
    reportedAt: new Date('2026-06-02T10:00:00Z'),
    resolvedAt: null,
    customerEmail: 'carlos@example.com',
  },
];

describe('AdminIncidentListPage', () => {
  let fixture: ComponentFixture<AdminIncidentListPage>;
  let component: AdminIncidentListPage;

  describe('with the real mock service', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminIncidentListPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminIncidentListPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ui-state, [role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();

      tick(400);
    }));

    it('renders the seeded incidents, spanning multiple customers, once loaded', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminIncidentListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-3001');
      expect(text).toContain('PED-3003');
      expect(text).toContain('ana.rojas@example.com');
      expect(text).toContain('carlos.mendez@example.com');
    }));

    it('renders the empty state for ?mockState=empty', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'empty' }),
      });
      fixture = TestBed.createComponent(AdminIncidentListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();
    }));

    it('renders the error state with a working retry for ?mockState=error', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'error' }),
      });
      fixture = TestBed.createComponent(AdminIncidentListPage);
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

  describe('search/status/priority filtering (test double service)', () => {
    beforeEach(async () => {
      const service: Partial<AdminIncidentsMockService> = {
        getIncidents: (): Observable<AdminIncidentViewModel[]> => of([...INCIDENTS]),
      };

      await TestBed.configureTestingModule({
        imports: [AdminIncidentListPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: AdminIncidentsMockService, useValue: service },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminIncidentListPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('narrows visible rows by description search', () => {
      component.updateSearch('color');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('carlos@example.com');
      expect(text).not.toContain('ana@example.com');
    });

    it('narrows visible rows by status', () => {
      component.updateStatusFilter('en_revision');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('carlos@example.com');
      expect(text).not.toContain('ana@example.com');
    });

    it('narrows visible rows by priority', () => {
      component.updatePriorityFilter('alta');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('carlos@example.com');
      expect(text).not.toContain('ana@example.com');
    });
  });

  it('renders the error state when the initial fetch fails (test double service)', () => {
    const failingService: Partial<AdminIncidentsMockService> = {
      getIncidents: (): Observable<AdminIncidentViewModel[]> => throwError(() => new Error('boom')),
    };

    TestBed.configureTestingModule({
      imports: [AdminIncidentListPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: AdminIncidentsMockService, useValue: failingService },
      ],
    });
    fixture = TestBed.createComponent(AdminIncidentListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });
});
