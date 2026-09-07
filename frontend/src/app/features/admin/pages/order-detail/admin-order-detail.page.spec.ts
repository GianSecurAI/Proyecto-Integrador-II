import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { AdminOrderDetailPage } from './admin-order-detail.page';
import { AdminOrdersMockService } from '../../services/admin-orders-mock.service';

/** Lightweight `ActivatedRoute` fake — mirrors `order-detail.page.spec.ts`'s (account feature)
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

function configure(id: string, queryParams: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    imports: [AdminOrderDetailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: fakeActivatedRoute(id, queryParams) },
    ],
  });
}

describe('AdminOrderDetailPage', () => {
  let fixture: ComponentFixture<AdminOrderDetailPage>;

  it('renders order id, status, timeline and customer info (name + phone present)', fakeAsync(() => {
    configure('PED-3001');
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-3001');
    expect(text).toContain('Entregado');
    expect(text).toContain('ana.rojas@example.com');
    expect(text).toContain('Ana Rojas');
    expect(text).toContain('+51 987 654 321');
    expect(fixture.nativeElement.querySelector('app-order-status-timeline')).toBeTruthy();
  }));

  it('renders gracefully when the customer name/phone are absent — only the email shows', fakeAsync(() => {
    configure('PED-3005');
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('diego.torres@example.com');
    expect(fixture.nativeElement.querySelector('dt')).toBeTruthy();
    // Only one customer <dt>/<dd> pair (the email) should exist for this order.
    const terms: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-order-detail-page__customer dt'),
    );
    expect(terms.length).toBe(1);
  }));

  it('renders the append-only status-history list', fakeAsync(() => {
    configure('PED-3001');
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const entries = fixture.nativeElement.querySelectorAll(
      '.admin-order-detail-page__timeline-entry',
    );
    expect(entries.length).toBe(5);
  }));

  it('offers only the allowed next statuses for an order starting at "pendiente"', fakeAsync(() => {
    configure('PED-3003'); // seeded at 'pendiente'
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const options: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select option'),
    );
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values.sort()).toEqual(['cancelado', 'confirmado']);
  }));

  it('offers only the allowed next statuses for an order starting at "confirmado"', fakeAsync(() => {
    configure('PED-3005'); // seeded at 'confirmado'
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const options: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select option'),
    );
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values.sort()).toEqual(['cancelado', 'en_produccion']);
  }));

  it('shows a terminal-state notice instead of a transition control for a terminal order', fakeAsync(() => {
    configure('PED-3001'); // seeded at 'entregado' — terminal
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('estado final');
  }));

  it('calls transitionStatus with the chosen next status and an optional note (test double service)', () => {
    const service: Partial<AdminOrdersMockService> & { transitionStatus: jasmine.Spy } = {
      getOrderById: () =>
        of({
          id: 'PED-X',
          placedAt: new Date('2026-01-01T00:00:00Z'),
          status: 'pendiente',
          kind: 'estandar',
          summary: 'Pedido de prueba',
          customerEmail: 'test@example.com',
          statusHistory: [
            {
              previousStatus: null,
              newStatus: 'pendiente',
              changedAt: new Date('2026-01-01T00:00:00Z'),
              responsible: 'Sistema',
              note: null,
            },
          ],
        }) as never,
      transitionStatus: jasmine.createSpy('transitionStatus').and.returnValue(of({} as never)),
    };

    TestBed.configureTestingModule({
      imports: [AdminOrderDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute('PED-X') },
        { provide: AdminOrdersMockService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.updateSelectedNextStatus('confirmado');
    component.updateTransitionNote('Pago verificado manualmente');
    fixture.detectChanges();
    component.submitTransition();

    expect(service.transitionStatus).toHaveBeenCalledOnceWith(
      'PED-X',
      'confirmado',
      'Pago verificado manualmente',
    );
  });

  it('shows a not-found state for an unknown order id (real state, not simulated)', fakeAsync(() => {
    configure('no-existe');
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pedido no encontrado');
  }));

  it('shows the error state with a working retry for ?mockState=error', fakeAsync(() => {
    configure('PED-3001', { mockState: 'error' });
    fixture = TestBed.createComponent(AdminOrderDetailPage);
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
