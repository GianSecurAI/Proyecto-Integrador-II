import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { CATALOG_PRODUCTS } from '../../mocks/catalog-products.mock';
import { CatalogService } from '../../services/catalog.service';
import { CatalogPage } from './catalog.page';

describe('CatalogPage', () => {
  let fixture: ComponentFixture<CatalogPage>;

  describe('loading and loaded states (real mock CatalogService)', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CatalogPage],
        providers: [provideRouter([])],
      }).compileComponents();
    });

    // `TestBed.createComponent` (which runs the constructor, and therefore the
    // `CatalogService.getProducts()` subscription) happens INSIDE each `fakeAsync` callback, not
    // in `beforeEach`, so the mock's `delay(500)` timer is scheduled on the fake clock `tick()`
    // can actually advance — creating it in a plain `async` `beforeEach` would schedule it on a
    // real timer that `tick()` can never see.

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-product-card')).toBeNull();

      tick(500);
    }));

    it('renders every mock product once the mock fetch resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();
      tick(500);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('app-product-card').length).toBe(
        CATALOG_PRODUCTS.length,
      );
    }));

    it('keeps the toolbar pills and the sidebar radio list in sync on the same category state', fakeAsync(() => {
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();
      tick(500);
      fixture.detectChanges();

      const pills: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.catalog-toolbar__pill'),
      );
      const llaveroPill = pills.find((pill) => pill.textContent?.includes('Llavero'))!;
      llaveroPill.click();
      fixture.detectChanges();

      const checkedRadio: HTMLInputElement = fixture.nativeElement.querySelector(
        'input[type="radio"]:checked',
      );
      expect(checkedRadio.value).toBe('llavero');

      const activePill = fixture.nativeElement.querySelector('.catalog-toolbar__pill--active');
      expect(activePill.textContent).toContain('Llavero');
    }));

    it('renders the empty state for a filter combination that matches zero products', fakeAsync(() => {
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();
      tick(500);
      fixture.detectChanges();

      fixture.componentInstance.onFiltersChange({
        category: 'descarga-digital',
        personalizableOnly: true,
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-product-card')).toBeNull();
    }));

    it('"Restablecer filtros" resets every filter back to its default', fakeAsync(() => {
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();
      tick(500);
      fixture.detectChanges();

      fixture.componentInstance.onFiltersChange({ category: 'pegatinas', onSaleOnly: true });
      fixture.detectChanges();

      const resetButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Restablecer'))!;
      resetButton.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filters()).toEqual({
        category: 'todo',
        onSaleOnly: false,
        personalizableOnly: false,
        minPrice: null,
        maxPrice: null,
        query: '',
      });
    }));
  });

  describe('error and retry (test double CatalogService)', () => {
    it('renders the error state when the fetch fails, and retry re-invokes the service', () => {
      let callCount = 0;
      const failingService: Partial<CatalogService> = {
        getProducts: (): Observable<CatalogProduct[]> => {
          callCount++;
          return throwError(() => new Error('boom'));
        },
      };

      TestBed.configureTestingModule({
        imports: [CatalogPage],
        providers: [{ provide: CatalogService, useValue: failingService }],
      });
      fixture = TestBed.createComponent(CatalogPage);
      fixture.detectChanges();

      expect(callCount).toBe(1);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes('Reintentar'))!;
      retryButton.click();
      fixture.detectChanges();

      expect(callCount).toBe(2);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    });
  });
});
