import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, ParamMap, convertToParamMap } from '@angular/router';
import { CustomerOrdersMockService } from '../../../account/services/customer-orders-mock.service';
import { TrackOrderPage } from './track-order.page';

/** Narrow `ActivatedRoute` fake — `TrackOrderPage` only ever reads
 * `route.snapshot.queryParamMap` (for the `?mockState=error` preview override), same narrow
 * -mocking convention as `order-detail.page.spec.ts`. */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const query: ParamMap = convertToParamMap(queryParams);
  return {
    snapshot: { queryParamMap: query } as ActivatedRouteSnapshot,
  };
}

function configure(queryParams: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    imports: [TrackOrderPage],
    providers: [{ provide: ActivatedRoute, useValue: fakeActivatedRoute(queryParams) }],
  });
}

describe('TrackOrderPage', () => {
  let fixture: ComponentFixture<TrackOrderPage>;
  let component: TrackOrderPage;

  it('renders the idle search form with an accessible, labeled order-id input and no password field', () => {
    configure();
    fixture = TestBed.createComponent(TrackOrderPage);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('text');
    expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });

  it('pre-fills the order-id input from a ?orderId= query param without auto-submitting', () => {
    configure({ orderId: 'PED-MOCK-1' });
    const getOrderByIdSpy = spyOn(CustomerOrdersMockService.prototype, 'getOrderById');
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Pre-filled (this is the confirmation page's "Rastrear mi pedido" hand-off — see
    // track-order.page.ts's constructor doc comment).
    expect(component.orderIdControl.value).toBe('PED-MOCK-1');
    // But never auto-submitted — the visitor still presses the lookup button themselves.
    expect(getOrderByIdSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('input').value).toBe('PED-MOCK-1');
  });

  it('never calls the lookup service and shows an accessible validation error for an empty submit', () => {
    configure();
    const getOrderByIdSpy = spyOn(CustomerOrdersMockService.prototype, 'getOrderById');
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.submit();
    fixture.detectChanges();

    expect(getOrderByIdSpy).not.toHaveBeenCalled();
    expect(component.status()).toBe('idle');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      fixture.nativeElement.querySelector(`[id="${input.getAttribute('aria-describedby')}"]`)
        .textContent,
    ).toContain('Ingresa el ID');
  });

  it('shows the loading state while the lookup is in flight', fakeAsync(() => {
    configure();
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.submit();
    fixture.detectChanges();

    expect(component.status()).toBe('loading');
    expect(fixture.nativeElement.querySelector('.ui-state--loading')).toBeTruthy();

    tick(400);
    fixture.detectChanges();
  }));

  it('renders identifier, status badge, timeline and full history for a real seeded order id', fakeAsync(() => {
    configure();
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.submit();
    tick(400);
    fixture.detectChanges();

    expect(component.status()).toBe('found');
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('PED-2031');
    expect(text).toContain('Entregado');
    expect(text).toContain('Pedido estándar');
    expect(fixture.nativeElement.querySelector('app-order-status-timeline')).toBeTruthy();
    const entries = fixture.nativeElement.querySelectorAll('.track-order-page__timeline-entry');
    expect(entries.length).toBe(5);
  }));

  it('shows a distinct not-found state for an id absent from the mock data (a real, non-simulated state)', fakeAsync(() => {
    configure();
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.orderIdControl.setValue('NO-EXISTE');
    component.submit();
    tick(400);
    fixture.detectChanges();

    expect(component.status()).toBe('not-found');
    expect(fixture.nativeElement.textContent).toContain('No encontramos ese pedido');
    // distinct from the generic error state: no alert role, different copy
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  }));

  it('shows the generic error state (distinct wording) with a working retry for ?mockState=error', fakeAsync(() => {
    configure({ mockState: 'error' });
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.submit();
    tick(400);
    fixture.detectChanges();

    expect(component.status()).toBe('error');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('No encontramos ese pedido');

    const retryButton = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Reintentar'))!;
    retryButton.click();
    fixture.detectChanges();
    expect(component.status()).toBe('loading');
    tick(400);
    fixture.detectChanges();
    expect(component.status()).toBe('error');
  }));

  it('returns to the idle search form via "Buscar otro pedido" without a full page reload', fakeAsync(() => {
    configure();
    fixture = TestBed.createComponent(TrackOrderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.orderIdControl.setValue('PED-2031');
    component.submit();
    tick(400);
    fixture.detectChanges();
    expect(component.status()).toBe('found');

    const resetButton = (
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
    ).find((b) => b.textContent?.includes('Buscar otro pedido'))!;
    resetButton.click();
    fixture.detectChanges();

    expect(component.status()).toBe('idle');
    expect(component.order()).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="text"]')).toBeTruthy();
  }));
});
