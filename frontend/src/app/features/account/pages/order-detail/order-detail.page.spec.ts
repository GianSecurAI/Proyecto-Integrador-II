import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { OrderDetailPage } from './order-detail.page';

/** Lightweight `ActivatedRoute` fake — only exposes what `OrderDetailPage` actually reads
 * (`paramMap`/`snapshot.paramMap` for `:id`, `queryParamMap`/`snapshot.queryParamMap` for
 * `?mockState=`), same narrow-mocking convention as `order-history.page.spec.ts`. */
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
    imports: [OrderDetailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: fakeActivatedRoute(id, queryParams) },
    ],
  });
}

describe('OrderDetailPage', () => {
  let fixture: ComponentFixture<OrderDetailPage>;

  it('renders the order identifier, date, status badge, type indicator and summary', fakeAsync(() => {
    configure('PED-2031');
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-2031');
    expect(text).toContain('Entregado');
    expect(text).toContain('Pedido estándar');
    expect(text).toContain('Set de 3 llaveros personalizados');
  }));

  it('renders the append-only status-history timeline in chronological order', fakeAsync(() => {
    configure('PED-2031');
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const entries: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.order-detail-page__timeline-entry'),
    );
    expect(entries.length).toBe(5);
    expect(entries[0].textContent).toContain('Pedido registrado');
    expect(entries[0].textContent).toContain('Pendiente');
    expect(entries[entries.length - 1].textContent).toContain('Enviado');
    expect(entries[entries.length - 1].textContent).toContain('Entregado');
  }));

  it('shows the demo-only repurchase message for a standard order and performs no real action', fakeAsync(() => {
    configure('PED-2031');
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(status.textContent?.trim()).toBe('');

    const button = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Volver a comprar'))!;
    button.click();
    fixture.detectChanges();

    expect(status.textContent).toContain('Vista de demostración');
    expect(status.textContent).toContain('recompra todavía no está disponible');
  }));

  it('does not render a repurchase action for a personalized order', fakeAsync(() => {
    configure('PED-2044');
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Pedido personalizado');
    expect(text).not.toContain('Volver a comprar');
  }));

  it('shows a not-found state for an unknown order id (real state, not simulated)', fakeAsync(() => {
    configure('no-existe');
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pedido no encontrado');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-empty-state a');
    expect(link.getAttribute('href')).toBe('/account/orders');
  }));

  it('shows the error state with a working retry for ?mockState=error', fakeAsync(() => {
    configure('PED-2031', { mockState: 'error' });
    fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const retryButton = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Reintentar'))!;
    retryButton.click();
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  }));
});
