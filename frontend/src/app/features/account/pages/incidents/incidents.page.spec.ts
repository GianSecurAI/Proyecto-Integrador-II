import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { IncidentViewModel } from '../../models/incident.model';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerIncidentsMockService } from '../../services/customer-incidents-mock.service';
import { CustomerOrdersMockService } from '../../services/customer-orders-mock.service';
import { IncidentsPage } from './incidents.page';

/** Lightweight `ActivatedRoute` fake — only exposes what `IncidentsPage` actually reads
 * (`queryParamMap`), mirroring the convention already used in `order-history.page.spec.ts`. */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

const SEED_ORDERS: OrderSummaryViewModel[] = [
  {
    id: 'PED-2031',
    placedAt: new Date('2026-06-02T15:04:00Z'),
    status: 'entregado',
    kind: 'estandar',
    summary: 'Set de 3 llaveros personalizados con silueta de mascota',
  },
  {
    id: 'PED-2050',
    placedAt: new Date('2026-08-20T09:30:00Z'),
    status: 'pendiente',
    kind: 'estandar',
    summary: 'Organizador de escritorio modular (2 unidades)',
  },
];

const SEED_INCIDENTS: IncidentViewModel[] = [
  {
    id: 'INC-0001',
    orderId: 'PED-2031',
    orderSummary: 'Set de 3 llaveros personalizados con silueta de mascota',
    description: 'Uno de los llaveros llegó con una fisura visible en la base.',
    status: 'resuelta',
    resolution: 'Se coordinó el reenvío sin costo adicional de la pieza dañada.',
    reportedAt: new Date('2026-06-10T09:00:00Z'),
    resolvedAt: new Date('2026-06-12T16:00:00Z'),
  },
  {
    id: 'INC-0002',
    orderId: 'PED-2050',
    orderSummary: 'Organizador de escritorio modular (2 unidades)',
    description: 'Todavía no recibo actualizaciones sobre el estado del pedido.',
    status: 'abierta',
    resolution: null,
    reportedAt: new Date('2026-09-05T10:30:00Z'),
    resolvedAt: null,
  },
];

type OrdersDouble = { getOrders: jasmine.Spy };
type IncidentsDouble = { getIncidents: jasmine.Spy; submitIncident: jasmine.Spy };

describe('IncidentsPage', () => {
  let fixture: ComponentFixture<IncidentsPage>;
  let component: IncidentsPage;
  let ordersService: OrdersDouble;
  let incidentsService: IncidentsDouble;

  function setup(queryParams: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [IncidentsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(queryParams) },
        { provide: CustomerOrdersMockService, useValue: ordersService },
        { provide: CustomerIncidentsMockService, useValue: incidentsService },
      ],
    });
    fixture = TestBed.createComponent(IncidentsPage);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    ordersService = { getOrders: jasmine.createSpy('getOrders').and.returnValue(of(SEED_ORDERS)) };
    incidentsService = {
      getIncidents: jasmine.createSpy('getIncidents').and.returnValue(of(SEED_INCIDENTS)),
      submitIncident: jasmine.createSpy('submitIncident'),
    };
  });

  it('populates the order-select control from CustomerOrdersMockService, not a second mock list', () => {
    setup();
    fixture.detectChanges();

    expect(ordersService.getOrders).toHaveBeenCalled();
    const options: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select option'),
    );
    expect(options.some((option) => option.textContent?.includes('PED-2031'))).toBeTrue();
    expect(options.some((option) => option.textContent?.includes('PED-2050'))).toBeTrue();
  });

  it('renders every seeded incident with order reference, status badge and reported date', () => {
    setup();
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-2031');
    expect(text).toContain('Resuelta');
    expect(text).toContain('Abierta');
    expect(fixture.nativeElement.querySelectorAll('app-status-badge').length).toBe(2);
  });

  it('displays resolution text only for a resolved incident, never fabricating one for an open incident', () => {
    setup();
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Se coordinó el reenvío sin costo adicional de la pieza dañada.');
    expect(text).toContain('Aún sin resolución.');
  });

  it('never shows a priority field, type field, or status input control', () => {
    setup();
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent!.toLowerCase();
    expect(text).not.toContain('prioridad');
    expect(text).not.toContain('tipo de incidencia');
    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(1); // only the order select
  });

  it('rejects submit with no order selected or a too-short description, with accessible feedback, and never submits', () => {
    setup();
    fixture.detectChanges();

    component.descriptionControl.setValue('short');
    component.submit();
    fixture.detectChanges();

    expect(incidentsService.submitIncident).not.toHaveBeenCalled();
    expect(component.orderIdControl.invalid).toBeTrue();
    expect(component.descriptionControl.invalid).toBeTrue();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    const describedBy = select.getAttribute('aria-describedby')!;
    expect(fixture.nativeElement.querySelector(`[id="${describedBy}"]`).textContent).toContain(
      'Selecciona el pedido',
    );
  });

  it('shows an accessible success message and appends the new incident to the list after a successful submission', () => {
    const created: IncidentViewModel = {
      id: 'INC-MOCK-1',
      orderId: 'PED-2031',
      orderSummary: 'Set de 3 llaveros personalizados con silueta de mascota',
      description: 'El empaque llegó dañado y una de las piezas se rompió en el transporte.',
      status: 'abierta',
      resolution: null,
      reportedAt: new Date('2026-09-07T10:00:00Z'),
      resolvedAt: null,
    };
    incidentsService.submitIncident.and.returnValue(of(created));
    setup();
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.descriptionControl.setValue(created.description);
    component.submit();
    fixture.detectChanges();

    expect(incidentsService.submitIncident).toHaveBeenCalledWith({
      orderId: 'PED-2031',
      description: created.description,
    });
    const status: HTMLElement = fixture.nativeElement.querySelector('.incidents-page__success');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('registrada');
    expect(fixture.nativeElement.textContent).toContain(created.description);
  });

  it('shows a generic, non-leaking error message on submit failure', () => {
    incidentsService.submitIncident.and.returnValue(
      throwError(() => new Error('Internal constraint: fk_incidencia_pedido violated')),
    );
    setup();
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.descriptionControl.setValue('Descripción suficientemente larga para pasar la validación.');
    component.submit();
    fixture.detectChanges();

    expect(component.submitError()).toBe(
      'No pudimos registrar tu incidencia. Inténtalo de nuevo más tarde.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('fk_incidencia_pedido');
    const alert: HTMLElement = fixture.nativeElement.querySelector('.incidents-page__error');
    expect(alert.textContent).toContain('No pudimos registrar');
  });

  describe('incident list async states', () => {
    it('renders a loading indicator before the incidents resolve', () => {
      incidentsService.getIncidents.and.returnValue(new Subject<IncidentViewModel[]>());
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.incidents-page__list')).toBeNull();
    });

    it('renders a friendly empty state without blocking the submission form above it', () => {
      incidentsService.getIncidents.and.returnValue(of([]));
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      expect(select.disabled).toBeFalse();
    });

    it('renders the error state with a retry action, which re-invokes the service', () => {
      incidentsService.getIncidents.and.returnValue(throwError(() => new Error('boom')));
      setup();
      fixture.detectChanges();

      expect(incidentsService.getIncidents).toHaveBeenCalledTimes(1);
      const historySection = fixture.nativeElement.querySelector('.incidents-page__history');
      expect(historySection.querySelector('app-error-state')).toBeTruthy();

      incidentsService.getIncidents.and.returnValue(of(SEED_INCIDENTS));
      const retryButton = (
        Array.from(historySection.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(incidentsService.getIncidents).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.querySelector('.incidents-page__list')).toBeTruthy();
    });
  });

  describe('order-select async states', () => {
    it('shows a loading message while the orders for the select are being fetched', () => {
      ordersService.getOrders.and.returnValue(new Subject<OrderSummaryViewModel[]>());
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Cargando tus pedidos');
      expect(fixture.nativeElement.querySelector('select')).toBeNull();
    });

    it('shows an error state with retry when the orders for the select fail to load', () => {
      ordersService.getOrders.and.returnValue(throwError(() => new Error('boom')));
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('select')).toBeNull();

      ordersService.getOrders.and.returnValue(of(SEED_ORDERS));
      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
    });
  });

  it('reflects ?mockState=empty on the incident list only, from the real mock service default wiring', () => {
    setup({ mockState: 'empty' });
    fixture.detectChanges();

    expect(incidentsService.getIncidents).toHaveBeenCalledWith('empty');
  });
});
