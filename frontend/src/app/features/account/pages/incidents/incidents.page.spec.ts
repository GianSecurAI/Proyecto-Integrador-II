import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { Page } from '../../../../core/models/page.model';
import { IncidentViewModel } from '../../models/incident.model';
import { OrderSummaryViewModel } from '../../models/order.model';
import { CustomerIncidentsService } from '../../services/customer-incidents.service';
import { CustomerOrdersService } from '../../services/customer-orders.service';
import { IncidentsPage } from './incidents.page';

function page<T>(content: T[]): Page<T> {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
}

const SEED_ORDERS: OrderSummaryViewModel[] = [
  {
    id: 'PED-2031',
    placedAt: new Date('2026-06-02T15:04:00Z'),
    status: 'ENTREGADO',
    kind: 'ESTANDAR',
    totalAmount: 10,
    summary: 'Set de 3 llaveros personalizados con silueta de mascota',
  },
  {
    id: 'PED-2050',
    placedAt: new Date('2026-08-20T09:30:00Z'),
    status: 'CONFIRMADO',
    kind: 'ESTANDAR',
    totalAmount: 10,
    summary: 'Organizador de escritorio modular (2 unidades)',
  },
];

const SEED_INCIDENTS: IncidentViewModel[] = [
  {
    id: 'INC-0001',
    orderId: 'PED-2031',
    orderSummary: 'Set de 3 llaveros personalizados con silueta de mascota',
    description: 'Uno de los llaveros llegó con una fisura visible en la base.',
    status: 'RESUELTA',
    resolution: 'Se coordinó el reenvío sin costo adicional de la pieza dañada.',
    reportedAt: new Date('2026-06-10T09:00:00Z'),
    resolvedAt: new Date('2026-06-12T16:00:00Z'),
  },
  {
    id: 'INC-0002',
    orderId: 'PED-2050',
    orderSummary: 'Organizador de escritorio modular (2 unidades)',
    description: 'Todavía no recibo actualizaciones sobre el estado del pedido.',
    status: 'ABIERTA',
    resolution: null,
    reportedAt: new Date('2026-09-05T10:30:00Z'),
    resolvedAt: null,
  },
];

interface OrdersDouble {
  list: jasmine.Spy;
}
interface IncidentsDouble {
  list: jasmine.Spy;
  register: jasmine.Spy;
}

describe('IncidentsPage', () => {
  let fixture: ComponentFixture<IncidentsPage>;
  let component: IncidentsPage;
  let ordersService: OrdersDouble;
  let incidentsService: IncidentsDouble;

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [IncidentsPage],
      providers: [
        provideRouter([]),
        { provide: CustomerOrdersService, useValue: ordersService },
        { provide: CustomerIncidentsService, useValue: incidentsService },
      ],
    });
    fixture = TestBed.createComponent(IncidentsPage);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    ordersService = { list: jasmine.createSpy('list').and.returnValue(of(page(SEED_ORDERS))) };
    incidentsService = {
      list: jasmine.createSpy('list').and.returnValue(of(page(SEED_INCIDENTS))),
      register: jasmine.createSpy('register'),
    };
  });

  it('populates the order-select control from the customer orders endpoint, not a second list', () => {
    setup();
    fixture.detectChanges();

    expect(ordersService.list).toHaveBeenCalled();
    const options: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select option'),
    );
    expect(options.some((option) => option.textContent?.includes('PED-2031'))).toBeTrue();
    expect(options.some((option) => option.textContent?.includes('PED-2050'))).toBeTrue();
  });

  it('renders every incident with order reference, status badge and reported date', () => {
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

    expect(incidentsService.register).not.toHaveBeenCalled();
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
      status: 'ABIERTA',
      resolution: null,
      reportedAt: new Date('2026-09-07T10:00:00Z'),
      resolvedAt: null,
    };
    incidentsService.register.and.returnValue(of(created));
    setup();
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.descriptionControl.setValue(created.description);
    component.submit();
    fixture.detectChanges();

    expect(incidentsService.register).toHaveBeenCalledWith({
      orderId: 'PED-2031',
      description: created.description,
    });
    const status: HTMLElement = fixture.nativeElement.querySelector('.incidents-page__success');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('registrada');
    expect(fixture.nativeElement.textContent).toContain(created.description);
  });

  it('shows a generic, non-leaking error message on submit failure', () => {
    incidentsService.register.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { code: 'INTERNAL_ERROR', message: 'Internal constraint: fk_incidencia_pedido violated', timestamp: 't' },
          }),
      ),
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
      incidentsService.list.and.returnValue(new Subject<Page<IncidentViewModel>>());
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-loading-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.incidents-page__list')).toBeNull();
    });

    it('renders a friendly empty state without blocking the submission form above it', () => {
      incidentsService.list.and.returnValue(of(page<IncidentViewModel>([])));
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      expect(select.disabled).toBeFalse();
    });

    it('renders the error state with a retry action, which re-invokes the service', () => {
      incidentsService.list.and.returnValue(throwError(() => new Error('boom')));
      setup();
      fixture.detectChanges();

      expect(incidentsService.list).toHaveBeenCalledTimes(1);
      const historySection = fixture.nativeElement.querySelector('.incidents-page__history');
      expect(historySection.querySelector('app-error-state')).toBeTruthy();

      incidentsService.list.and.returnValue(of(page(SEED_INCIDENTS)));
      const retryButton = (
        Array.from(historySection.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(incidentsService.list).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.querySelector('.incidents-page__list')).toBeTruthy();
    });
  });

  describe('order-select async states', () => {
    it('shows a loading message while the orders for the select are being fetched', () => {
      ordersService.list.and.returnValue(new Subject<Page<OrderSummaryViewModel>>());
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Cargando tus pedidos');
      expect(fixture.nativeElement.querySelector('select')).toBeNull();
    });

    it('shows an error state with retry when the orders for the select fail to load', () => {
      ordersService.list.and.returnValue(throwError(() => new Error('boom')));
      setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('select')).toBeNull();

      ordersService.list.and.returnValue(of(page(SEED_ORDERS)));
      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
    });
  });

  describe('backend rejections of POST /api/incidents', () => {
    function submitWith(error: HttpErrorResponse): void {
      incidentsService.register.and.returnValue(throwError(() => error));
      setup();
      fixture.detectChanges();
      component.orderIdControl.setValue('PED-2031');
      component.descriptionControl.setValue('Descripción suficientemente larga para pasar la validación.');
      component.submit();
      fixture.detectChanges();
    }

    it('explains 404 (unknown order or an order of another customer)', () => {
      submitWith(new HttpErrorResponse({ status: 404, error: { code: 'NOT_FOUND', message: 'x', timestamp: 't' } }));
      expect(component.submitError()).toContain('No encontramos ese pedido');
    });

    it('explains 409 CONFLICT (duplicate open incident / cap of 5 per order)', () => {
      submitWith(new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: 'x', timestamp: 't' } }));
      expect(component.submitError()).toContain('incidencia abierta');
    });

    it('shows 400 VALIDATION_FAILED field errors on the matching control', () => {
      submitWith(
        new HttpErrorResponse({
          status: 400,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'x',
            timestamp: 't',
            fieldErrors: [{ field: 'description', message: 'must be at least 20 characters' }],
          },
        }),
      );
      expect(component.descriptionControl.errors?.['server']).toBe('must be at least 20 characters');
      expect(component.submitError()).toContain('Revisa los datos');
    });
  });
});
