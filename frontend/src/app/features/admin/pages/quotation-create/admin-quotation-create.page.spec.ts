import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminQuotationCreatePage } from './admin-quotation-create.page';

describe('AdminQuotationCreatePage (POST /api/admin/quotations)', () => {
  let fixture: ComponentFixture<AdminQuotationCreatePage>;
  let component: AdminQuotationCreatePage;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminQuotationCreatePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(AdminQuotationCreatePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function fill(overrides: Partial<{ email: string; description: string; amount: number | null }> = {}) {
    component.customerEmailControl.setValue(overrides.email ?? ' ana@example.com ');
    component.descriptionControl.setValue(overrides.description ?? '  50 llaveros con el logo  ');
    component.agreedAmountControl.setValue(overrides.amount === undefined ? 250 : overrides.amount);
    component.notesControl.setValue('Acordado por WhatsApp');
  }

  it('sends nothing while the form is invalid', () => {
    fill({ email: 'no-es-correo', amount: null });
    component.submit();
    http.expectNone('/api/admin/quotations');
    expect(component.form.touched).toBeTrue();
  });

  it('POSTs the trimmed data and opens the new quotation', () => {
    fill();
    component.submit();
    const req = http.expectOne('/api/admin/quotations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      customerEmail: 'ana@example.com',
      description: '50 llaveros con el logo',
      agreedAmount: 250,
      notes: 'Acordado por WhatsApp',
    });
    req.flush({ id: 12 });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/quotations', 12]);
  });

  it('explains a staff or deactivated customer account (409)', () => {
    fill();
    component.submit();
    http
      .expectOne('/api/admin/quotations')
      .flush({ code: 'CUSTOMER_NOT_ELIGIBLE', message: 'x', timestamp: 't' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('cuenta de personal');
    expect(component.submitting()).toBeFalse();
  });
});
