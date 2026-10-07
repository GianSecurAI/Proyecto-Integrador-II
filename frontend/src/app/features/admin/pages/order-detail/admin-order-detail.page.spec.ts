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
import { AdminOrderDetailPage } from './admin-order-detail.page';

/** Lightweight `ActivatedRoute` fake exposing only `paramMap` for `:id`. */
function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `AdminOrderDetailDto` (AdminOrderController GET /{orderId}). */
function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'PED-9001',
    placedAt: '2026-06-01T10:00:00Z',
    status: 'CONFIRMADO',
    kind: 'ESTANDAR',
    summary: '2 unidades: Llavero',
    totalAmount: 25,
    agreedAmount: null,
    description: null,
    items: [{ productId: 5, title: 'Llavero', unitPrice: 12.5, quantity: 2, lineTotal: 25 }],
    delivery: { address: 'Av. 1', district: 'Lima', notes: null },
    customerEmail: 'ana@example.com',
    customerName: 'Ana',
    customerPhone: '987654321',
    registeredBy: null,
    statusHistory: [
      {
        previousStatus: null,
        newStatus: 'CONFIRMADO',
        changedAt: '2026-06-01T10:00:00Z',
        responsible: 'Sistema',
        note: null,
      },
    ],
    allowedNextStatuses: ['EN_PRODUCCION', 'CANCELADO'],
    ...overrides,
  };
}

describe('AdminOrderDetailPage (GET /api/admin/orders/{id}, PATCH .../status)', () => {
  let fixture: ComponentFixture<AdminOrderDetailPage>;
  let component: AdminOrderDetailPage;
  let http: HttpTestingController;
  const url = '/api/admin/orders/PED-9001';

  function create(id = 'PED-9001') {
    TestBed.configureTestingModule({
      imports: [AdminOrderDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminOrderDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  function load(body: object = detail()) {
    http.expectOne(url).flush(body);
    fixture.detectChanges();
  }

  it('renders id, status, customer info, items, total and delivery from the server', () => {
    create();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    load();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-9001');
    expect(text).toContain('Confirmado');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('987654321');
    expect(text).toContain('Llavero × 2');
    expect(text).toContain('S/ 25.00');
    expect(text).toContain('Av. 1, Lima');
    expect(text).not.toContain('Vista de demostración');
  });

  it('renders gracefully when customer name/phone are null — only the email shows', () => {
    create();
    load(detail({ customerName: null, customerPhone: null }));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('ana@example.com');
    expect(text).not.toContain('Nombre');
  });

  it('shows agreed amount, description and registrar for a personalized order', () => {
    create();
    load(
      detail({
        kind: 'PERSONALIZADO',
        status: 'CONFIRMADO',
        agreedAmount: 180,
        totalAmount: 180,
        description: 'Trofeo a medida',
        items: [],
        delivery: null,
        registeredBy: 'asesor@armakers3d.com',
        allowedNextStatuses: ['EN_PRODUCCION', 'CANCELADO'],
      }),
    );
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Pedido personalizado');
    expect(text).toContain('monto acordado S/ 180.00');
    expect(text).toContain('Trofeo a medida');
    expect(text).toContain('Registrado por asesor@armakers3d.com');
  });

  it('offers EXACTLY the allowedNextStatuses sent by the server (no client-side lifecycle)', () => {
    create();
    load(detail({ status: 'ENVIADO', allowedNextStatuses: ['ENTREGADO'] }));
    const options = Array.from(fixture.nativeElement.querySelectorAll('select option')) as HTMLOptionElement[];
    const labels = options.filter((o) => o.value).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Entregado']);
  });

  it('shows a terminal-state notice instead of a transition control when none is allowed', () => {
    create();
    load(detail({ status: 'ENTREGADO', allowedNextStatuses: [] }));
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('estado final');
  });

  it('PATCHes the chosen status with the optional note and renders the returned order', () => {
    create();
    load();
    component.updateSelectedNextStatus('EN_PRODUCCION');
    component.updateTransitionNote(' Pago verificado ');
    component.submitTransition();
    const req = http.expectOne(`${url}/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'EN_PRODUCCION', note: 'Pago verificado' });
    req.flush(
      detail({
        status: 'EN_PRODUCCION',
        allowedNextStatuses: ['ENVIADO', 'CANCELADO'],
        statusHistory: [
          { previousStatus: null, newStatus: 'CONFIRMADO', changedAt: '2026-06-01T10:00:00Z', responsible: 'Sistema', note: null },
          {
            previousStatus: 'CONFIRMADO',
            newStatus: 'EN_PRODUCCION',
            changedAt: '2026-06-01T11:00:00Z',
            responsible: 'asesor@armakers3d.com',
            note: 'Pago verificado',
          },
        ],
      }),
    );
    fixture.detectChanges();
    expect(component.order()?.status).toBe('EN_PRODUCCION');
    expect(component.transitionSuccess()).toContain('actualizó');
    expect(fixture.nativeElement.textContent).toContain('Pago verificado');
    expect(component.allowedNextStatuses()).toEqual(['ENVIADO', 'CANCELADO']);
  });

  it('omits the note when blank', () => {
    create();
    load();
    component.updateSelectedNextStatus('CANCELADO');
    component.submitTransition();
    const req = http.expectOne(`${url}/status`);
    expect(req.request.body).toEqual({ status: 'CANCELADO' });
    req.flush(detail({ status: 'CANCELADO', allowedNextStatuses: [] }));
  });

  it('on 409 INVALID_STATUS_TRANSITION shows a message and reloads the current server state', () => {
    create();
    load();
    component.updateSelectedNextStatus('EN_PRODUCCION');
    component.submitTransition();
    http
      .expectOne(`${url}/status`)
      .flush(
        { code: 'INVALID_STATUS_TRANSITION', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.transitionError()).toContain('ya no es válido');
    // The page re-fetches the order so the offered next statuses are current again.
    http.expectOne(url).flush(detail({ status: 'CONFIRMADO', allowedNextStatuses: ['EN_PRODUCCION', 'CANCELADO'] }));
    expect(component.allowedNextStatuses()).toEqual(['EN_PRODUCCION', 'CANCELADO']);
  });

  it('shows a generic error on a server failure and does not change the order', () => {
    create();
    load();
    component.updateSelectedNextStatus('EN_PRODUCCION');
    component.submitTransition();
    http
      .expectOne(`${url}/status`)
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    expect(component.transitionError()).toContain('No pudimos actualizar');
    expect(component.order()?.status).toBe('CONFIRMADO');
  });

  it('shows not-found on 404', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedido no encontrado');
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
    expect(fixture.nativeElement.textContent).toContain('PED-9001');
  });
});
