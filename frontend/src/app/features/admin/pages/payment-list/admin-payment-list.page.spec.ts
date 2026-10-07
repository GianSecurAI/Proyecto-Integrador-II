import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { Page } from '../../../../core/models/page.model';
import { PaymentSummaryDto } from '../../models/admin-payment.model';
import { AdminPaymentsService } from '../../services/admin-payments.service';
import { makeSummary } from '../../testing/payment-fixtures';
import { AdminPaymentListPage } from './admin-payment-list.page';

function pageOf(content: PaymentSummaryDto[], totalPages = 1): Page<PaymentSummaryDto> {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('AdminPaymentListPage', () => {
  let fixture: ComponentFixture<AdminPaymentListPage>;
  let list: jasmine.Spy;

  function setup(result: (query: unknown) => Observable<Page<PaymentSummaryDto>>) {
    list = jasmine.createSpy('list').and.callFake(result);
    TestBed.configureTestingModule({
      imports: [AdminPaymentListPage],
      providers: [provideRouter([]), { provide: AdminPaymentsService, useValue: { list } }],
    });
    fixture = TestBed.createComponent(AdminPaymentListPage);
    fixture.detectChanges();
  }

  it('loads PROOF_SUBMITTED by default and renders the queue with the duplicate badge', () => {
    setup(() => of(pageOf([makeSummary(), makeSummary({ checkoutId: 'c2', reference: 'AM3D-OTHER000', duplicateProofWarning: true })])));
    expect(list).toHaveBeenCalledWith({ status: 'PROOF_SUBMITTED', page: 0 });
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('AM3D-3F2B8C1E');
    expect(rows[0].textContent).toContain('S/ 87.30');
    expect(rows[0].textContent).toContain('Yape');
    expect(rows[0].textContent).not.toContain('Captura repetida');
    expect(rows[1].textContent).toContain('Captura repetida');
    const link: HTMLAnchorElement = rows[0].querySelector('a');
    expect(link.getAttribute('href')).toBe('/admin/payments/3f2b8c1e-0000-4000-8000-000000000001');
  });

  it('shows the empty state', () => {
    setup(() => of(pageOf([])));
    expect(fixture.nativeElement.textContent).toContain('No hay pagos por verificar');
  });

  it('shows an error with retry', () => {
    let calls = 0;
    setup(() => (++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(pageOf([makeSummary()]))));
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar los pagos');
    (fixture.nativeElement.querySelector('app-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('shows the Retry-After wait on 429', () => {
    setup(() =>
      throwError(() => new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '45' }), error: { code: 'RATE_LIMITED', message: 'x', timestamp: 't' } })),
    );
    expect(fixture.nativeElement.textContent).toContain('45 segundos');
  });

  it('changing the status filter reloads from page 0 with that status', () => {
    setup(() => of(pageOf([makeSummary()], 3)));
    fixture.componentInstance.goToPage(1);
    expect(list).toHaveBeenCalledWith({ status: 'PROOF_SUBMITTED', page: 1 });
    fixture.componentInstance.updateStatusFilter('PAID');
    expect(list).toHaveBeenCalledWith({ status: 'PAID', page: 0 });
  });

  it('paginates only when there is more than one page', () => {
    setup(() => of(pageOf([makeSummary()], 1)));
    expect(fixture.nativeElement.querySelector('nav[aria-label="Paginación de pagos"]')).toBeNull();
  });
});
