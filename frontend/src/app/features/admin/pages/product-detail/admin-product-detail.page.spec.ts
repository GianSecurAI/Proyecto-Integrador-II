import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import { AdminProductViewModel } from '../../models/admin-product.model';
import { AdminProductsMockService } from '../../services/admin-products-mock.service';
import { AdminProductDetailPage } from './admin-product-detail.page';

/** Lightweight `ActivatedRoute` fake — mirrors `order-detail.page.spec.ts`'s narrow-mocking
 * convention (`:id` via `paramMap`, `?mockState=` via `queryParamMap`). */
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
    imports: [AdminProductDetailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: fakeActivatedRoute(id, queryParams) },
    ],
  });
}

// Mirrors the real seed entry `adm-llavero-1` in `../../mocks/admin-products.mock.ts` exactly —
// tests below that don't override `AdminProductsMockService` exercise the REAL service against
// this real seeded id, same convention as `order-detail.page.spec.ts`'s `'PED-2031'`.
const PRODUCT: AdminProductViewModel = {
  id: 'adm-llavero-1',
  category: 'llavero',
  subcategory: 'Llaveros personalizados',
  title: 'Llavero con silueta de mascota',
  price: 21.9,
  personalizable: true,
  description:
    'Llavero impreso en PLA con la silueta de tu mascota, disponible en varios colores de acabado mate.',
  available: true,
  characteristics: ['Material: PLA', 'Alto impacto a la caída', 'Incluye argolla metálica'],
};

describe('AdminProductDetailPage', () => {
  let fixture: ComponentFixture<AdminProductDetailPage>;
  let component: AdminProductDetailPage;

  it('renders the product read-only, including the availability badge', fakeAsync(() => {
    configure(PRODUCT.id);
    fixture = TestBed.createComponent(AdminProductDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero con silueta de mascota');
    expect(text).toContain('Activo');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  }));

  it('pre-fills the edit form with the current product values when entering edit mode', fakeAsync(() => {
    configure(PRODUCT.id);
    fixture = TestBed.createComponent(AdminProductDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.startEditing();
    fixture.detectChanges();

    const formComponent = fixture.debugElement.query(By.directive(AdminProductFormComponent))
      .componentInstance as AdminProductFormComponent;
    expect(formComponent.titleControl.value).toBe('Llavero con silueta de mascota');
    expect(formComponent.subcategoryControl.value).toBe('Llaveros personalizados');
    expect(formComponent.priceControl.value).toBe(21.9);
  }));

  it('reverts to view mode without saving when edit mode is cancelled', fakeAsync(() => {
    configure(PRODUCT.id);
    fixture = TestBed.createComponent(AdminProductDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.startEditing();
    fixture.detectChanges();
    component.cancelEditing();
    fixture.detectChanges();

    expect(component.editing()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Llavero con silueta de mascota');
  }));

  it('shows a success message and updates the view after a successful save (test double service)', fakeAsync(() => {
    const updated: AdminProductViewModel = { ...PRODUCT, title: 'Llavero actualizado' };
    const service: Partial<AdminProductsMockService> = {
      getProductById: () => of(PRODUCT),
      updateProduct: jasmine.createSpy('updateProduct').and.returnValue(of(updated)) as any,
    };
    TestBed.configureTestingModule({
      imports: [AdminProductDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(PRODUCT.id) },
        { provide: AdminProductsMockService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(AdminProductDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.startEditing();
    component.save({
      title: 'Llavero actualizado',
      category: 'llavero',
      subcategory: 'Llaveros personalizados',
      description: 'Descripción del llavero.',
      price: 21.9,
      compareAtPrice: null,
      personalizable: true,
      characteristics: 'Material: PLA',
    });
    fixture.detectChanges();

    expect(component.editing()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Llavero actualizado');
    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(status.textContent).toContain('actualizó');
  }));

  it('shows a not-found state for an unknown product id (real state, not simulated)', fakeAsync(() => {
    configure('no-existe');
    fixture = TestBed.createComponent(AdminProductDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Producto no encontrado');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-empty-state a');
    expect(link.getAttribute('href')).toBe('/admin/products');
  }));

  it('shows the error state with a working retry for ?mockState=error', fakeAsync(() => {
    configure(PRODUCT.id, { mockState: 'error' });
    fixture = TestBed.createComponent(AdminProductDetailPage);
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
