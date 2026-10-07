import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogPage, CATALOG_SEARCH_DEBOUNCE_MS } from './catalog.page';

/** Shape copied from backend `Page<ProductSummaryDto>` (see CatalogController / MockMvc tests). */
function page(
  content: object[],
  extra: Partial<{ page: number; totalPages: number; totalElements: number }> = {},
) {
  return {
    content,
    page: extra.page ?? 0,
    size: 12,
    totalElements: extra.totalElements ?? content.length,
    totalPages: extra.totalPages ?? 1,
  };
}
const P1 = { id: 1, title: 'Llavero naranja', category: 'LLAVERO', subcategory: 'Llaveros', price: 19.9 };
const P2 = { id: 2, title: 'Pack pegatinas', category: 'PEGATINAS', subcategory: 'Stickers', price: 7.5 };

describe('CatalogPage (server-driven)', () => {
  let fixture: ComponentFixture<CatalogPage>;
  let http: HttpTestingController;

  const catalogReq = () => http.expectOne((r) => r.url === '/api/catalog/products');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function create(): void {
    fixture = TestBed.createComponent(CatalogPage);
    fixture.detectChanges();
  }

  it('shows the loading state, then the products returned by the server', () => {
    create();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    const req = catalogReq();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('sort')).toBe('createdAt,desc');
    expect(req.request.params.has('category')).toBeFalse();
    req.flush(page([P1, P2]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(2);
  });

  it('shows the empty state when the server returns no products', () => {
    create();
    catalogReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('shows an error state with a working retry on failure', () => {
    create();
    catalogReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    const retry: HTMLButtonElement = fixture.nativeElement.querySelector('app-error-state button');
    retry.click();
    catalogReq().flush(page([P1]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(1);
  });

  it('sends the UPPER_CASE category to the server and keeps pills and radios in sync', () => {
    create();
    catalogReq().flush(page([P1, P2]));
    fixture.detectChanges();

    const pills: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.catalog-toolbar__pill'),
    );
    pills.find((pill) => pill.textContent?.includes('Pegatinas'))!.click();
    fixture.detectChanges();

    const req = catalogReq();
    expect(req.request.params.get('category')).toBe('PEGATINAS');
    req.flush(page([P2]));
    fixture.detectChanges();
    const checked: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="radio"]:checked',
    );
    expect(checked.value).toBe('PEGATINAS');
  });

  it('debounces search and sends it as q', fakeAsync(() => {
    create();
    catalogReq().flush(page([P1]));
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = 'llav';
    input.dispatchEvent(new Event('input'));
    http.expectNone((r) => r.url === '/api/catalog/products');
    tick(CATALOG_SEARCH_DEBOUNCE_MS);
    const req = catalogReq();
    expect(req.request.params.get('q')).toBe('llav');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([P1]));
  }));

  it('sends price range and sort to the server', fakeAsync(() => {
    create();
    catalogReq().flush(page([P1]));
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.onFiltersChange({ minPrice: 5, maxPrice: 20 });
    tick(CATALOG_SEARCH_DEBOUNCE_MS);
    const priced = catalogReq();
    expect(priced.request.params.get('minPrice')).toBe('5');
    expect(priced.request.params.get('maxPrice')).toBe('20');
    priced.flush(page([P1]));
    comp.onFiltersChange({ sort: 'price,asc' });
    const sorted = catalogReq();
    expect(sorted.request.params.get('sort')).toBe('price,asc');
    sorted.flush(page([P1]));
  }));

  it('pages through server pages and resets to page 0 when a filter changes', () => {
    create();
    catalogReq().flush(page([P1], { totalPages: 3, totalElements: 30 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.catalog-page__pagination')).toBeTruthy();

    fixture.componentInstance.goToPage(1);
    const second = catalogReq();
    expect(second.request.params.get('page')).toBe('1');
    second.flush(page([P2], { page: 1, totalPages: 3, totalElements: 30 }));

    fixture.componentInstance.onFiltersChange({ category: 'LLAVERO' });
    const reset = catalogReq();
    expect(reset.request.params.get('page')).toBe('0');
    reset.flush(page([P1]));
  });

  it('does not offer on-sale or personalizable filters (not in the backend contract)', () => {
    create();
    catalogReq().flush(page([P1]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Solo en oferta');
    expect(fixture.nativeElement.textContent).not.toContain('Solo personalizable');
    expect(fixture.nativeElement.textContent).not.toContain('Descarga digital');
  });
});
