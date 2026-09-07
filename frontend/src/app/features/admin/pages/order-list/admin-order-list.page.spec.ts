import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminOrderSummaryViewModel } from '../../models/admin-order.model';
import { AdminOrdersMockService } from '../../services/admin-orders-mock.service';
import { AdminOrderListPage } from './admin-order-list.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-product-list.page.spec.ts`'s narrow-mocking
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
    id: 'PED-9001',
    placedAt: new Date('2026-06-01T10:00:00Z'),
    status: 'pendiente',
    kind: 'estandar',
    summary: 'Set de llaveros',
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
  },
  {
    id: 'PED-9002',
    placedAt: new Date('2026-06-02T10:00:00Z'),
    status: 'confirmado',
    kind: 'personalizado',
    summary: 'Trofeo personalizado',
    customerEmail: 'carlos@example.com',
  },
];

describe('AdminOrderListPage', () => {
  let fixture: ComponentFixture<AdminOrderListPage>;
  let component: AdminOrderListPage;

  describe('with the real mock service', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminOrderListPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminOrderListPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ui-state, [role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();

      tick(400);
    }));

    it('renders the seeded orders, spanning multiple customers, once loaded', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminOrderListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-3001');
      expect(text).toContain('ana.rojas@example.com');
      expect(text).toContain('carlos.mendez@example.com');
    }));

    it('renders the empty state for ?mockState=empty', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'empty' }),
      });
      fixture = TestBed.createComponent(AdminOrderListPage);
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
      fixture = TestBed.createComponent(AdminOrderListPage);
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

    it('has a page-header action linking to the personalized-order registration screen', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminOrderListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
        'a[href="/admin/orders/register-personalized"]',
      );
      expect(link).toBeTruthy();
    }));
  });

  describe('search/status/kind filtering (test double service)', () => {
    beforeEach(async () => {
      const service: Partial<AdminOrdersMockService> = {
        getOrders: (): Observable<AdminOrderSummaryViewModel[]> => of([...ORDERS]),
      };

      await TestBed.configureTestingModule({
        imports: [AdminOrderListPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: AdminOrdersMockService, useValue: service },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminOrderListPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('narrows visible rows by order id or customer email search', () => {
      component.updateSearch('carlos@');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-9002');
      expect(text).not.toContain('PED-9001');
    });

    it('narrows visible rows by status', () => {
      component.updateStatusFilter('confirmado');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-9002');
      expect(text).not.toContain('PED-9001');
    });

    it('narrows visible rows by kind', () => {
      component.updateKindFilter('personalizado');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-9002');
      expect(text).not.toContain('PED-9001');
    });
  });

  it('renders the error state when the initial fetch fails (test double service)', () => {
    const failingService: Partial<AdminOrdersMockService> = {
      getOrders: (): Observable<AdminOrderSummaryViewModel[]> => throwError(() => new Error('boom')),
    };

    TestBed.configureTestingModule({
      imports: [AdminOrderListPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: AdminOrdersMockService, useValue: failingService },
      ],
    });
    fixture = TestBed.createComponent(AdminOrderListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
  });
});
