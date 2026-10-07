import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home.page';

/** Shape copied from backend `Page<ProductSummaryDto>` (CatalogController list). */
const PAGE = {
  content: [
    { id: 11, title: 'Llavero A', category: 'LLAVERO', subcategory: 'Llaveros', price: 12.5 },
    { id: 12, title: 'Pegatina B', category: 'PEGATINAS', subcategory: 'Stickers', price: 4 },
  ],
  page: 0,
  size: 4,
  totalElements: 2,
  totalPages: 1,
};

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function flushLatest(body: object = PAGE): void {
    const req = http.expectOne(
      (r) => r.url === '/api/catalog/products' && r.params.get('sort') === 'createdAt,desc',
    );
    expect(req.request.params.get('size')).toBe('4');
    req.flush(body);
    fixture.detectChanges();
  }

  it('composes hero, why-choose-us, the latest-products showcase and the final CTA', () => {
    flushLatest();
    const el = fixture.nativeElement;
    expect(el.querySelector('app-hero')).toBeTruthy();
    expect(el.querySelectorAll('app-product-showcase').length).toBe(1);
    expect(el.querySelectorAll('app-product-card').length).toBe(2);
    expect(el.querySelector('app-why-choose-us')).toBeTruthy();
    expect(el.querySelector('app-final-cta')).toBeTruthy();
  });

  it('provides exactly one <main> landmark (the shell renders none of its own)', () => {
    flushLatest();
    expect(fixture.nativeElement.querySelectorAll('main').length).toBe(1);
  });

  it('omits the showcase (and still renders) when the catalog request fails', () => {
    http
      .expectOne((r) => r.url === '/api/catalog/products')
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-product-showcase')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-final-cta')).toBeTruthy();
  });
});
