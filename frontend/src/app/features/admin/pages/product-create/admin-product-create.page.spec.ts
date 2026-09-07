import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminProductFormComponent } from '../../components/admin-product-form/admin-product-form.component';
import { AdminProductViewModel, ProductFormValue } from '../../models/admin-product.model';
import { AdminProductsMockService } from '../../services/admin-products-mock.service';
import { AdminProductCreatePage } from './admin-product-create.page';

const VALID_VALUE: ProductFormValue = {
  title: 'Llavero de prueba',
  category: 'llavero',
  subcategory: 'Llaveros de prueba',
  description: 'Un llavero de prueba para el formulario.',
  price: 19.9,
  compareAtPrice: null,
  personalizable: false,
  characteristics: '',
};

const CREATED: AdminProductViewModel = {
  id: 'adm-mock-1',
  category: VALID_VALUE.category,
  subcategory: VALID_VALUE.subcategory,
  title: VALID_VALUE.title,
  price: VALID_VALUE.price,
  compareAtPrice: undefined,
  personalizable: false,
  description: VALID_VALUE.description,
  available: true,
  characteristics: [],
};

describe('AdminProductCreatePage', () => {
  let fixture: ComponentFixture<AdminProductCreatePage>;
  let component: AdminProductCreatePage;
  let service: { createProduct: jasmine.Spy };
  let router: Router;

  beforeEach(async () => {
    service = { createProduct: jasmine.createSpy('createProduct') };

    await TestBed.configureTestingModule({
      imports: [AdminProductCreatePage],
      providers: [
        provideRouter([]),
        { provide: AdminProductsMockService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProductCreatePage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  function formComponent(): AdminProductFormComponent {
    return fixture.debugElement.query(By.directive(AdminProductFormComponent))
      .componentInstance as AdminProductFormComponent;
  }

  it('blocks submission and never calls the service when required fields are missing', () => {
    formComponent().submit();
    fixture.detectChanges();

    expect(service.createProduct).not.toHaveBeenCalled();
    expect(formComponent().titleControl.invalid).toBeTrue();
  });

  it('blocks submission when price is zero or negative', () => {
    const form = formComponent();
    form.titleControl.setValue('Producto de prueba');
    form.subcategoryControl.setValue('Sub');
    form.descriptionControl.setValue('Descripción de prueba.');
    form.priceControl.setValue(0);
    form.submit();
    fixture.detectChanges();

    expect(service.createProduct).not.toHaveBeenCalled();
    expect(form.priceControl.invalid).toBeTrue();
  });

  it('calls createProduct with the trimmed form value when valid, and navigates to the new product on success', async () => {
    service.createProduct.and.returnValue(of(CREATED));
    const navigateSpy = spyOn(router, 'navigate');

    const form = formComponent();
    form.titleControl.setValue('  Llavero de prueba  ');
    form.categoryControl.setValue('llavero');
    form.subcategoryControl.setValue('Llaveros de prueba');
    form.descriptionControl.setValue('Un llavero de prueba para el formulario.');
    form.priceControl.setValue(19.9);
    form.submit();
    fixture.detectChanges();

    expect(service.createProduct).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ title: 'Llavero de prueba', price: 19.9 }),
    );
    expect(navigateSpy).toHaveBeenCalledOnceWith(['/admin/products', CREATED.id]);
  });

  it('shows a generic error and does not navigate when creation fails', () => {
    service.createProduct.and.returnValue(throwError(() => new Error('boom')));
    const navigateSpy = spyOn(router, 'navigate');

    const form = formComponent();
    form.titleControl.setValue('Llavero de prueba');
    form.subcategoryControl.setValue('Llaveros de prueba');
    form.descriptionControl.setValue('Un llavero de prueba para el formulario.');
    form.priceControl.setValue(19.9);
    form.submit();
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('No pudimos crear el producto');
    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('No pudimos crear el producto');
  });

  it('navigates back to the product list when cancelled', () => {
    const navigateSpy = spyOn(router, 'navigate');
    formComponent().cancelled.emit();
    expect(navigateSpy).toHaveBeenCalledOnceWith(['/admin/products']);
  });
});
