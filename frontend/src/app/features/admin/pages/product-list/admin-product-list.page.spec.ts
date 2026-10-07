import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminProductListPage, PRODUCT_SEARCH_DEBOUNCE_MS } from './admin-product-list.page';

/** Shapes copied from backend `Page<AdminProductDto>` (AdminProductController list). */
function dto(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Producto ${id}`,
    category: 'LLAVERO',
    subcategory: 'Sub',
    price: 10 + id,
    description: 'd',
    characteristics: [],
    images: [],
    available: true,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

function page(content: object[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('AdminProductListPage (GET /api/admin/products)', () => {
  let fixture: ComponentFixture<AdminProductListPage>;
  let component: AdminProductListPage;
  let http: HttpTestingController;
  const listReq = () => http.expectOne((r) => r.method === 'GET' && r.url === '/api/admin/products');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminProductListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows loading, then the server products (including unavailable ones) with status badges', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    listReq().flush(page([dto(1), dto(2, { available: false, category: 'PEGATINAS' })]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Pegatinas');
    expect(text).toContain('Inactivo');
    expect(text).not.toContain('Vista de demostración');
  });

  it('sends category and availability filters to the server', () => {
    listReq().flush(page([dto(1)]));
    component.updateCategoryFilter('PEGATINAS');
    const byCategory = listReq();
    expect(byCategory.request.params.get('category')).toBe('PEGATINAS');
    byCategory.flush(page([]));
    component.updateAvailabilityFilter('no-disponibles');
    const byAvailability = listReq();
    expect(byAvailability.request.params.get('available')).toBe('false');
    byAvailability.flush(page([]));
  });

  it('debounces search and sends q', fakeAsync(() => {
    listReq().flush(page([dto(1)]));
    component.updateSearch('llavero');
    http.expectNone((r) => r.url === '/api/admin/products');
    tick(PRODUCT_SEARCH_DEBOUNCE_MS);
    const req = listReq();
    expect(req.request.params.get('q')).toBe('llavero');
    req.flush(page([dto(1)]));
  }));

  it('shows the empty state when there are no products and a no-match state under filters', () => {
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay productos');
    component.updateCategoryFilter('LLAVERO');
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ningún producto coincide');
  });

  it('opens the confirm dialog when deactivating and PATCHes { available: false } only after confirming', () => {
    listReq().flush(page([dto(1)]));
    fixture.detectChanges();
    component.requestDeactivate(component.products()[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    http.expectNone((r) => r.method === 'PATCH');
    component.confirmDeactivate();
    const req = http.expectOne('/api/admin/products/1/availability');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ available: false });
    req.flush(dto(1, { available: false }));
    expect(component.products()[0].available).toBeFalse();
  });

  it('does not call the API when the dialog is cancelled', () => {
    listReq().flush(page([dto(1)]));
    component.requestDeactivate(component.products()[0]);
    component.cancelDeactivate();
    http.expectNone((r) => r.method === 'PATCH');
  });

  it('reactivating PATCHes { available: true } immediately, without a dialog', () => {
    listReq().flush(page([dto(2, { available: false })]));
    component.activate(component.products()[0]);
    const req = http.expectOne('/api/admin/products/2/availability');
    expect(req.request.body).toEqual({ available: true });
    req.flush(dto(2, { available: true }));
    expect(component.products()[0].available).toBeTrue();
  });

  it('shows an error message when the availability change fails', () => {
    listReq().flush(page([dto(1)]));
    component.activate(component.products()[0]);
    http
      .expectOne('/api/admin/products/1/availability')
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    expect(component.availabilityError()).toContain('No pudimos actualizar');
  });

  it('shows an error state with a working retry', () => {
    listReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    fixture.nativeElement.querySelector('app-error-state button').click();
    listReq().flush(page([dto(1)]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });
});
