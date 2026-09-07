import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminProductViewModel } from '../../models/admin-product.model';
import { AdminProductsMockService } from '../../services/admin-products-mock.service';
import { AdminProductListPage } from './admin-product-list.page';

/** Lightweight `ActivatedRoute` fake — mirrors `order-history.page.spec.ts`'s narrow-mocking
 * convention: only exposes `queryParamMap` (this page reacts to `?mockState=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

const PRODUCTS: AdminProductViewModel[] = [
  {
    id: 'p-1',
    category: 'llavero',
    subcategory: 'Llaveros personalizados',
    title: 'Llavero con silueta de mascota',
    price: 21.9,
    personalizable: true,
    description: 'Descripción del llavero.',
    available: true,
    characteristics: ['Material: PLA'],
  },
  {
    id: 'p-2',
    category: 'pegatinas',
    subcategory: 'Pegatinas personalizadas',
    title: 'Set de pegatinas personalizadas',
    price: 14.5,
    description: 'Descripción de las pegatinas.',
    available: false,
    characteristics: [],
  },
];

describe('AdminProductListPage', () => {
  let fixture: ComponentFixture<AdminProductListPage>;
  let component: AdminProductListPage;

  describe('with the real mock service', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminProductListPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminProductListPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ui-state, [role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();

      tick(400);
    }));

    it('renders the seeded products in the table once loaded', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminProductListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Llavero con silueta de mascota');
      expect(text).toContain('Activo');
      expect(text).toContain('Inactivo');
    }));

    it('renders the empty state for ?mockState=empty', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'empty' }),
      });
      fixture = TestBed.createComponent(AdminProductListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();
    }));

    it('renders the error state with a working retry for ?mockState=error', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'error' }),
      });
      fixture = TestBed.createComponent(AdminProductListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

      const retryButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Reintentar'))!;
      retryButton.click();
      tick(400);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    }));
  });

  describe('search and category filtering, and the availability toggle (test double service)', () => {
    let service: Partial<AdminProductsMockService> & {
      setAvailability: jasmine.Spy;
    };

    beforeEach(async () => {
      service = {
        getProducts: (): Observable<AdminProductViewModel[]> => of([...PRODUCTS]),
        setAvailability: jasmine.createSpy('setAvailability'),
      };

      await TestBed.configureTestingModule({
        imports: [AdminProductListPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: AdminProductsMockService, useValue: service },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminProductListPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('narrows visible rows by case-insensitive title search', () => {
      component.updateSearch('pegatinas');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Set de pegatinas personalizadas');
      expect(text).not.toContain('Llavero con silueta de mascota');
    });

    it('narrows visible rows by category', () => {
      component.updateCategoryFilter('llavero');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Llavero con silueta de mascota');
      expect(text).not.toContain('Set de pegatinas personalizadas');
    });

    it('opens the confirm dialog when deactivating, and does NOT call setAvailability until confirmed', () => {
      const deactivateButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Desactivar'))!;
      deactivateButton.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
      expect(service.setAvailability).not.toHaveBeenCalled();
    });

    it('calls setAvailability(id, false) only after confirming the dialog', () => {
      service.setAvailability.and.returnValue(of({ ...PRODUCTS[0], available: false }));

      const deactivateButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Desactivar'))!;
      deactivateButton.click();
      fixture.detectChanges();

      const confirmButton = (
        Array.from(
          fixture.nativeElement.querySelectorAll('.admin-confirm-dialog__actions button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Desactivar'))!;
      confirmButton.click();
      fixture.detectChanges();

      expect(service.setAvailability).toHaveBeenCalledOnceWith('p-1', false);
      expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    });

    it('does NOT call setAvailability when the confirm dialog is cancelled', () => {
      const deactivateButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Desactivar'))!;
      deactivateButton.click();
      fixture.detectChanges();

      const cancelButton = (
        Array.from(
          fixture.nativeElement.querySelectorAll('.admin-confirm-dialog__actions button'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Cancelar'))!;
      cancelButton.click();
      fixture.detectChanges();

      expect(service.setAvailability).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    });

    it('reactivating an inactive product calls setAvailability(id, true) immediately, without a dialog', () => {
      service.setAvailability.and.returnValue(of({ ...PRODUCTS[1], available: true }));

      const activateButton = (
        Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes('Activar'))!;
      activateButton.click();
      fixture.detectChanges();

      expect(service.setAvailability).toHaveBeenCalledOnceWith('p-2', true);
      expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    });
  });

  it('renders the error state when the initial fetch fails (test double service)', () => {
    const failingService: Partial<AdminProductsMockService> = {
      getProducts: (): Observable<AdminProductViewModel[]> => throwError(() => new Error('boom')),
    };

    TestBed.configureTestingModule({
      imports: [AdminProductListPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: AdminProductsMockService, useValue: failingService },
      ],
    });
    fixture = TestBed.createComponent(AdminProductListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});
