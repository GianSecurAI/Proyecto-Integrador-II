import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
} from '@angular/router';
import { TrackOrderPage } from './track-order.page';

/** Narrow `ActivatedRoute` fake — the page only reads `snapshot.queryParamMap` (`?orderId=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const query: ParamMap = convertToParamMap(queryParams);
  return { snapshot: { queryParamMap: query } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `OrderResponseDto`. */
const ORDER = {
  id: 'PED-20261006-0001',
  placedAt: '2026-10-06T15:30:00Z',
  status: 'CONFIRMADO',
  kind: 'ESTANDAR',
  summary: '1 unidad: Llavero',
  totalAmount: 12.5,
  items: [{ productId: 5, title: 'Llavero', unitPrice: 12.5, quantity: 1, lineTotal: 12.5 }],
  delivery: { address: 'Av. 1', district: 'Lima', notes: null },
  statusHistory: [
    {
      previousStatus: null,
      newStatus: 'CONFIRMADO',
      changedAt: '2026-10-06T15:30:00Z',
      responsible: 'Sistema',
      note: null,
    },
    {
      previousStatus: 'CONFIRMADO',
      newStatus: 'EN_PRODUCCION',
      changedAt: '2026-10-06T16:00:00Z',
      responsible: 'asesor@armakers3d.com',
      note: 'Pago verificado',
    },
  ],
};

describe('TrackOrderPage (owner lookup, GET /api/orders/{id})', () => {
  let fixture: ComponentFixture<TrackOrderPage>;
  let component: TrackOrderPage;
  let http: HttpTestingController;

  function create(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [TrackOrderPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(queryParams) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  it('renders the idle search form with an accessible, labeled order-id input and no password field', () => {
    create();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('text');
    expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Vista de demostración');
  });

  it('pre-fills the order id from ?orderId= without auto-submitting', () => {
    create({ orderId: 'PED-20261006-0001' });
    expect(component.orderIdControl.value).toBe('PED-20261006-0001');
    http.expectNone(() => true);
  });

  it('never calls the API and shows a validation error for an empty submit', () => {
    create();
    component.submit();
    fixture.detectChanges();
    http.expectNone(() => true);
    expect(component.status()).toBe('idle');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('looks up the order (owner endpoint), shows status and the server history', () => {
    create();
    component.orderIdControl.setValue(' PED-20261006-0001 ');
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    http.expectOne('/api/orders/PED-20261006-0001').flush(ORDER);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-20261006-0001');
    expect(text).toContain('Confirmado');
    expect(text).toContain('Confirmado → En producción');
    expect(text).toContain('Pago verificado');
  });

  it('shows not-found on 404 (unknown id or another customer order)', () => {
    create();
    component.orderIdControl.setValue('PED-OTRO');
    component.submit();
    http
      .expectOne('/api/orders/PED-OTRO')
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(component.status()).toBe('not-found');
    expect(fixture.nativeElement.textContent).toContain('No encontramos ese pedido');
  });

  it('shows a generic error with retry on a server failure', () => {
    create();
    component.orderIdControl.setValue('PED-1');
    component.submit();
    http
      .expectOne('/api/orders/PED-1')
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(component.status()).toBe('error');
    component.retry();
    http.expectOne('/api/orders/PED-1').flush(ORDER);
    expect(component.status()).toBe('found');
  });

  it('"Buscar otro pedido" returns to the idle form', () => {
    create();
    component.orderIdControl.setValue('PED-1');
    component.submit();
    http.expectOne('/api/orders/PED-1').flush(ORDER);
    component.reset();
    expect(component.status()).toBe('idle');
    expect(component.order()).toBeNull();
  });
});
