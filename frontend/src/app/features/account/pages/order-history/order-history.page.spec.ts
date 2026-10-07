import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CheckoutStateService } from '../../../checkout/state/checkout-state.service';
import { OrderHistoryPage } from './order-history.page';

/** Shapes copied from backend `Page<OrderSummaryDto>` (OrderController list). */
const SUMMARY_STANDARD = {
  id: 'PED-20261006-0001',
  placedAt: '2026-10-06T15:30:00Z',
  status: 'EN_PRODUCCION',
  kind: 'ESTANDAR',
  summary: '3 unidades: Llavero naranja y 1 producto más',
  totalAmount: 47.5,
};
const SUMMARY_CUSTOM = {
  id: 'PED-20261001-0007',
  placedAt: '2026-10-01T10:00:00Z',
  status: 'CONFIRMADO',
  kind: 'PERSONALIZADO',
  summary: 'Figura a medida',
  totalAmount: 120,
};

function page(content: object[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('OrderHistoryPage (GET /api/orders)', () => {
  let fixture: ComponentFixture<OrderHistoryPage>;
  let http: HttpTestingController;
  const ordersReq = () => http.expectOne((r) => r.url === '/api/orders');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderHistoryPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderHistoryPage);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows the loading state first, then the server orders with label, status, kind and total', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    ordersReq().flush(page([SUMMARY_STANDARD, SUMMARY_CUSTOM]));
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-20261006-0001');
    expect(text).toContain('En producción');
    expect(text).toContain('Confirmado');
    expect(text).toContain('Pedido estándar');
    expect(text).toContain('Pedido personalizado');
    expect(text).toContain('S/ 47.50');
    expect(fixture.nativeElement.querySelectorAll('.order-history-page__item').length).toBe(2);
    expect(text).not.toContain('Vista de demostración');
  });

  it('links each order to its detail page', () => {
    ordersReq().flush(page([SUMMARY_STANDARD]));
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.order-history-page__item');
    expect(link.getAttribute('href')).toBe('/account/orders/PED-20261006-0001');
  });

  it('renders the empty state when the customer has no orders', () => {
    ordersReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('renders an error state with a working retry', () => {
    ordersReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    fixture.nativeElement.querySelector('app-error-state button').click();
    ordersReq().flush(page([SUMMARY_STANDARD]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.order-history-page__item').length).toBe(1);
  });

  it('pages through server pages', () => {
    ordersReq().flush(page([SUMMARY_STANDARD], 2));
    fixture.detectChanges();
    fixture.componentInstance.goToPage(1);
    const second = ordersReq();
    expect(second.request.params.get('page')).toBe('1');
    second.flush(page([SUMMARY_CUSTOM], 2));
  });

  it('shows a "pago pendiente" banner linking to the payment page only while a checkout is pending', () => {
    ordersReq().flush(page([SUMMARY_STANDARD]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="pending-payment-banner"]')).toBeNull();

    TestBed.inject(CheckoutStateService).setPendingCheckoutId('c-123');
    fixture.detectChanges();
    const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="pending-payment-banner"]');
    expect(banner.textContent).toContain('pago pendiente');
    expect(banner.querySelector('a')!.getAttribute('href')).toBe('/checkout/confirmacion?checkoutId=c-123');
  });
});
