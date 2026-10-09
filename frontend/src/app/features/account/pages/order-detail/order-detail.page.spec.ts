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
import { CartStateService } from '../../../cart/services/cart-state.service';
import { OrderDetailPage } from './order-detail.page';

/** Lightweight `ActivatedRoute` fake — only exposes `paramMap` for `:id`. */
function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `OrderResponseDto` (OrderController GET /api/orders/{id}). */
const ORDER = {
  id: 'PED-20261006-0001',
  placedAt: '2026-10-06T15:30:00Z',
  status: 'ENVIADO',
  kind: 'ESTANDAR',
  summary: '3 unidades: Llavero naranja y 1 producto más',
  totalAmount: 47.5,
  items: [
    { productId: 5, title: 'Llavero naranja', unitPrice: 12.5, quantity: 2, lineTotal: 25 },
    { productId: 6, title: 'Pack pegatinas', unitPrice: 22.5, quantity: 1, lineTotal: 22.5 },
  ],
  delivery: { address: 'Av. Siempre Viva 123', district: 'Miraflores', notes: null },
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
    {
      previousStatus: 'EN_PRODUCCION',
      newStatus: 'ENVIADO',
      changedAt: '2026-10-07T09:00:00Z',
      responsible: 'asesor@armakers3d.com',
      note: null,
    },
  ],
};

describe('OrderDetailPage (GET /api/orders/{id})', () => {
  let fixture: ComponentFixture<OrderDetailPage>;
  let http: HttpTestingController;

  function create(id: string) {
    TestBed.configureTestingModule({
      imports: [OrderDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  it('renders id, status badge, kind, items, total and delivery from the server response', () => {
    create('PED-20261006-0001');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    http.expectOne('/api/orders/PED-20261006-0001').flush(ORDER);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-20261006-0001');
    expect(text).toContain('Enviado');
    expect(text).toContain('Pedido estándar');
    expect(text).toContain('Llavero naranja');
    expect(text).toContain('S/ 47.50');
    expect(text).toContain('Av. Siempre Viva 123, Miraflores');
    expect(text).not.toContain('Volver a comprar');
    expect(text).not.toContain('Vista de demostración');
  });

  it('renders the append-only status history exactly as the server sent it', () => {
    create('PED-20261006-0001');
    http.expectOne('/api/orders/PED-20261006-0001').flush(ORDER);
    fixture.detectChanges();
    const entries: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.order-detail-page__timeline-entry'),
    );
    expect(entries.length).toBe(3);
    expect(entries[0].textContent).toContain('Pedido registrado');
    expect(entries[1].textContent).toContain('Confirmado → En producción');
    expect(entries[1].textContent).toContain('Pago verificado');
    expect(entries[2].textContent).toContain('En producción → Enviado');
  });

  it('shows not-found on 404 (unknown order or another customer order, indistinguishable)', () => {
    create('PED-OTRO');
    http
      .expectOne('/api/orders/PED-OTRO')
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedido no encontrado');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-empty-state a');
    expect(link.getAttribute('href')).toBe('/account/orders');
  });

  it('shows an error state with a working retry on a server error', () => {
    create('PED-20261006-0001');
    http
      .expectOne('/api/orders/PED-20261006-0001')
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retry = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    http.expectOne('/api/orders/PED-20261006-0001').flush(ORDER);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PED-20261006-0001');
  });

  describe('buy again (RF-14)', () => {
    const REORDER = {
      orderId: 'PED-20261006-0001',
      availableCount: 1,
      items: [
        { productId: 5, title: 'Llavero naranja', category: 'LLAVERO', subcategory: 'Llaveros', unitPrice: 14, quantity: 2, available: true },
        { productId: 6, title: 'Pack pegatinas', category: 'PEGATINAS', subcategory: 'Sets', unitPrice: 22.5, quantity: 1, available: false },
      ],
    };

    function openLoaded() {
      create('PED-20261006-0001');
      TestBed.inject(CartStateService).clearCart(); // the cart persists in localStorage between tests
      http.expectOne('/api/orders/PED-20261006-0001').flush(ORDER);
      fixture.detectChanges();
    }

    function reorderButton(): HTMLButtonElement | undefined {
      return (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((b) =>
        b.textContent?.includes('Comprar de nuevo'),
      );
    }

    it('puts only the available products in the cart at the CURRENT price and reports the rest', () => {
      openLoaded();
      reorderButton()!.click();
      http.expectOne('/api/orders/PED-20261006-0001/reorder').flush(REORDER);
      fixture.detectChanges();
      const cart = TestBed.inject(CartStateService);
      expect(cart.items().length).toBe(1);
      expect(cart.items()[0]).toEqual(jasmine.objectContaining({ productId: 5, quantity: 2, unitPrice: 14 }));
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Agregamos 1 producto(s) a tu carrito');
      expect(text).toContain('1 producto(s) ya no están disponibles');
    });

    it('shows an alert when the server fails and adds nothing', () => {
      openLoaded();
      reorderButton()!.click();
      http
        .expectOne('/api/orders/PED-20261006-0001/reorder')
        .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
      fixture.detectChanges();
      expect(TestBed.inject(CartStateService).items().length).toBe(0);
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('No pudimos preparar la compra');
    });

    it('is not offered for a personalized order', () => {
      create('PED-20261006-0001');
      http.expectOne('/api/orders/PED-20261006-0001').flush({ ...ORDER, kind: 'PERSONALIZADO' });
      fixture.detectChanges();
      expect(reorderButton()).toBeUndefined();
    });
  });
});
