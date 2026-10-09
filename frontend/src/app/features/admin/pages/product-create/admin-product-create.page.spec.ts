import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import { AdminProductViewModel } from '../../models/admin-product.model';
import { AdminProductsService } from '../../services/admin-products.service';
import { AdminProductCreatePage } from './admin-product-create.page';

const CREATED = { id: 12 } as AdminProductViewModel;

describe('AdminProductCreatePage (POST /api/admin/products)', () => {
  let fixture: ComponentFixture<AdminProductCreatePage>;
  let component: AdminProductCreatePage;
  let service: { create: jasmine.Spy };
  let router: Router;

  beforeEach(async () => {
    service = { create: jasmine.createSpy('create') };
    await TestBed.configureTestingModule({
      imports: [AdminProductCreatePage],
      providers: [provideRouter([]), { provide: AdminProductsService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminProductCreatePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function form(): AdminProductFormComponent {
    return fixture.debugElement.query(By.directive(AdminProductFormComponent))
      .componentInstance as AdminProductFormComponent;
  }

  function fillValid(): void {
    const f = form();
    f.titleControl.setValue('  Llavero de prueba ');
    f.categoryControl.setValue('PEGATINAS');
    f.subcategoryControl.setValue('Llaveros de prueba');
    f.descriptionControl.setValue('Un llavero de prueba para el formulario.');
    f.priceControl.setValue(19.9);
    f.characteristicsControl.setValue('PLA\n\n  Resistente  \n');
  }

  it('offers only the backend categories and no discount / personalizable fields', () => {
    expect(form().categories).toEqual(['LLAVERO', 'PEGATINAS', 'FIGURA', 'DECORACION']);
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Personalizable');
    expect(text).not.toContain('antes de descuento');
    expect(text).not.toContain('Vista de demostración');
  });

  it('blocks submission and never calls the service when required fields are missing', () => {
    form().submit();
    expect(service.create).not.toHaveBeenCalled();
    expect(form().titleControl.touched).toBeTrue();
  });

  it('blocks a non-positive price, a price above the maximum and more than 2 decimals (UX mirror)', () => {
    fillValid();
    for (const bad of [0, -5, 100000, 1.999]) {
      form().priceControl.setValue(bad);
      form().submit();
    }
    expect(service.create).not.toHaveBeenCalled();
  });

  it('blocks over-long fields and too many characteristics (UX mirror of ProductRules)', () => {
    fillValid();
    form().titleControl.setValue('x'.repeat(121));
    form().submit();
    form().titleControl.setValue('ok');
    form().characteristicsControl.setValue(Array.from({ length: 21 }, (_, i) => `c${i}`).join('\n'));
    form().submit();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('calls create with the form value and navigates to the new product on success', () => {
    service.create.and.returnValue(of(CREATED));
    const navigateSpy = spyOn(router, 'navigate');
    fillValid();
    form().submit();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.create.calls.mostRecent().args[0]).toEqual({
      title: 'Llavero de prueba',
      category: 'PEGATINAS',
      subcategory: 'Llaveros de prueba',
      description: 'Un llavero de prueba para el formulario.',
      price: 19.9,
      characteristics: 'PLA\n\n  Resistente  \n',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/products', 12]);
  });

  it('shows 400 VALIDATION_FAILED field errors on the matching control and does not navigate', () => {
    service.create.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'x',
              timestamp: 't',
              fieldErrors: [{ field: 'price', message: 'must be greater than 0' }],
            },
          }),
      ),
    );
    const navigateSpy = spyOn(router, 'navigate');
    fillValid();
    form().submit();
    fixture.detectChanges();
    expect(form().priceControl.errors?.['server']).toBe('must be greater than 0');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Revisa los campos');
  });

  it('shows a generic error and does not navigate when creation fails otherwise', () => {
    service.create.and.returnValue(throwError(() => new Error('boom')));
    const navigateSpy = spyOn(router, 'navigate');
    fillValid();
    form().submit();
    fixture.detectChanges();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('No pudimos crear el producto');
  });

  it('navigates back to the product list when cancelled', () => {
    const navigateSpy = spyOn(router, 'navigate');
    form().cancelled.emit();
    expect(navigateSpy).toHaveBeenCalledOnceWith(['/admin/products']);
  });
});
