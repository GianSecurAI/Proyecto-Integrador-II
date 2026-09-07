import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerOrdersMockService } from '../../services/customer-orders-mock.service';
import { OrderHistoryPage } from './order-history.page';

/** Lightweight `ActivatedRoute` fake — only exposes what `OrderHistoryPage` actually reads
 * (`queryParamMap` / `snapshot.queryParamMap`), mirroring the narrow-`Pick` mocking convention
 * already used for `CustomerProfileMockService` in `profile.page.spec.ts`. */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

describe('OrderHistoryPage', () => {
  let fixture: ComponentFixture<OrderHistoryPage>;

  describe('loading and loaded states (real mock service)', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [OrderHistoryPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(OrderHistoryPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.order-history-page__item')).toBeNull();

      tick(400);
    }));

    it('renders every mock order with its identifier, date, status badge and type indicator', fakeAsync(() => {
      fixture = TestBed.createComponent(OrderHistoryPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('PED-2031');
      expect(text).toContain('Entregado');
      expect(text).toContain('Pedido estándar');
      expect(text).toContain('Pedido personalizado');
      expect(fixture.nativeElement.querySelectorAll('.order-history-page__item').length).toBeGreaterThan(1);
    }));

    it('links each order to its detail route', fakeAsync(() => {
      fixture = TestBed.createComponent(OrderHistoryPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.order-history-page__item');
      expect(link.getAttribute('href')).toBe('/account/orders/PED-2031');
    }));
  });

  describe('empty state (?mockState=empty)', () => {
    it('renders a friendly empty message with a link back to the catalog', fakeAsync(() => {
      TestBed.configureTestingModule({
        imports: [OrderHistoryPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute({ mockState: 'empty' }) },
        ],
      });
      fixture = TestBed.createComponent(OrderHistoryPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.order-history-page__item')).toBeNull();
      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-empty-state a');
      expect(link.getAttribute('href')).toBe('/catalog');
    }));
  });

  describe('error and retry (test double service)', () => {
    it('renders the error state when the fetch fails, and retry re-invokes the service', () => {
      let callCount = 0;
      const failingService: Partial<CustomerOrdersMockService> = {
        getOrders: (): Observable<OrderSummaryViewModel[]> => {
          callCount++;
          return throwError(() => new Error('boom'));
        },
      };

      TestBed.configureTestingModule({
        imports: [OrderHistoryPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: CustomerOrdersMockService, useValue: failingService },
        ],
      });
      fixture = TestBed.createComponent(OrderHistoryPage);
      fixture.detectChanges();

      expect(callCount).toBe(1);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(callCount).toBe(2);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    });
  });
});
