import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import { AdminProductDetailPage } from './admin-product-detail.page';

function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `AdminProductDto`. */
function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    title: 'Llavero naranja',
    category: 'LLAVERO',
    subcategory: 'Llaveros personalizados',
    price: 19.9,
    description: 'Un llavero impreso en 3D.',
    characteristics: ['PLA', 'Resistente'],
    images: [],
    available: true,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z',
    ...overrides,
  };
}

describe('AdminProductDetailPage (GET/PUT /api/admin/products/{id})', () => {
  let fixture: ComponentFixture<AdminProductDetailPage>;
  let component: AdminProductDetailPage;
  let http: HttpTestingController;
  const url = '/api/admin/products/5';

  function create(id = '5') {
    TestBed.configureTestingModule({
      imports: [AdminProductDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminProductDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  function load(body: object = product()) {
    http.expectOne(url).flush(body);
    fixture.detectChanges();
  }

  function form(): AdminProductFormComponent {
    return fixture.debugElement.query(By.directive(AdminProductFormComponent))
      .componentInstance as AdminProductFormComponent;
  }

  it('renders the product read-only with the availability badge and no discount/personalizable rows', () => {
    create();
    load();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Llavero naranja');
    expect(text).toContain('Llavero');
    expect(text).toContain('S/ 19.90');
    expect(text).toContain('Resistente');
    expect(text).toContain('Activo');
    expect(text).not.toContain('Personalizable');
    expect(text).not.toContain('antes de descuento');
    expect(text).not.toContain('Vista de demostración');
  });

  it('pre-fills the edit form with the current values', () => {
    create();
    load();
    component.startEditing();
    fixture.detectChanges();
    expect(form().titleControl.value).toBe('Llavero naranja');
    expect(form().priceControl.value).toBe(19.9);
    expect(form().characteristicsControl.value).toBe('PLA\nResistente');
  });

  it('reverts to view mode without calling the API when editing is cancelled', () => {
    create();
    load();
    component.startEditing();
    component.cancelEditing();
    fixture.detectChanges();
    expect(component.editing()).toBeFalse();
    http.expectNone(url);
  });

  it('PUTs the full ProductWriteRequest and shows the updated product', () => {
    create();
    load();
    component.startEditing();
    fixture.detectChanges();
    form().priceControl.setValue(25);
    form().characteristicsControl.setValue('PLA\n\nResistente\nBrillante');
    form().submit();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      title: 'Llavero naranja',
      category: 'LLAVERO',
      subcategory: 'Llaveros personalizados',
      description: 'Un llavero impreso en 3D.',
      price: 25,
      characteristics: ['PLA', 'Resistente', 'Brillante'],
    });
    expect(Object.keys(req.request.body)).not.toContain('available');
    req.flush(product({ price: 25, characteristics: ['PLA', 'Resistente', 'Brillante'] }));
    fixture.detectChanges();
    expect(component.editing()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('S/ 25.00');
    expect(component.successMessage()).toContain('actualizó');
  });

  it('shows 400 VALIDATION_FAILED messages on the matching field and stays in edit mode', () => {
    create();
    load();
    component.startEditing();
    fixture.detectChanges();
    form().submit();
    http.expectOne(url).flush(
      {
        code: 'VALIDATION_FAILED',
        message: 'x',
        timestamp: 't',
        fieldErrors: [{ field: 'title', message: 'must not be blank' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(component.editing()).toBeTrue();
    expect(form().titleControl.errors?.['server']).toBe('must not be blank');
  });

  it('shows a generic error on a failed save and stays in edit mode', () => {
    create();
    load();
    component.startEditing();
    fixture.detectChanges();
    form().submit();
    http
      .expectOne(url)
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    expect(component.errorMessage()).toContain('No pudimos guardar');
    expect(component.editing()).toBeTrue();
  });

  it('shows not-found on 404 and for a non-numeric id (without calling the API)', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Producto no encontrado');
    TestBed.resetTestingModule();
    create('abc');
    expect(fixture.nativeElement.textContent).toContain('Producto no encontrado');
    http.expectNone((r) => r.url.startsWith('/api/admin/products'));
  });

  it('shows an error state with a working retry on a server failure', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    const retry = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    load();
    expect(fixture.nativeElement.textContent).toContain('Llavero naranja');
  });
});
