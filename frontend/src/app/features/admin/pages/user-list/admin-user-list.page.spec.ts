import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminUserListPage, USER_SEARCH_DEBOUNCE_MS } from './admin-user-list.page';

/** Shapes copied from backend `Page<AdminUserDto>` (AdminUserController list). */
const USERS = [
  { id: 1, email: 'maria.gonzales@example.com', role: 'CLIENTE', createdAt: '2025-01-14T15:20:00Z', active: true },
  { id: 2, email: 'asesor.andrea@armakers3d.com', role: 'ASESOR', createdAt: '2024-11-05T09:00:00Z', active: false },
];

function page(content: object[], totalPages = 1) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages };
}

describe('AdminUserListPage (GET/POST /api/admin/users)', () => {
  let fixture: ComponentFixture<AdminUserListPage>;
  let component: AdminUserListPage;
  let http: HttpTestingController;
  const listReq = () => http.expectOne((r) => r.method === 'GET' && r.url === '/api/admin/users');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminUserListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows loading, then the server users with role and active badges', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    listReq().flush(page(USERS));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('maria.gonzales@example.com');
    expect(text).toContain('Asesor');
    expect(text).toContain('Inactivo');
    expect(text).not.toContain('Vista de demostración');
  });

  it('sends role and active filters to the server', () => {
    listReq().flush(page(USERS));
    component.updateRoleFilter('ASESOR');
    const byRole = listReq();
    expect(byRole.request.params.get('role')).toBe('ASESOR');
    byRole.flush(page([USERS[1]]));
    component.updateActiveFilter('inactivos');
    const byActive = listReq();
    expect(byActive.request.params.get('active')).toBe('false');
    expect(byActive.request.params.get('role')).toBe('ASESOR');
    byActive.flush(page([USERS[1]]));
  });

  it('debounces the email search and sends it as q', fakeAsync(() => {
    listReq().flush(page(USERS));
    component.updateSearch('maria');
    http.expectNone((r) => r.url === '/api/admin/users');
    tick(USER_SEARCH_DEBOUNCE_MS);
    const req = listReq();
    expect(req.request.params.get('q')).toBe('maria');
    req.flush(page([USERS[0]]));
  }));

  it('shows the empty state when the server returns nothing', () => {
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay usuarios');
  });

  it('shows a no-match state (filters stay visible) when a filter returns nothing', () => {
    listReq().flush(page(USERS));
    component.updateRoleFilter('ADMINISTRADOR');
    listReq().flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ningún usuario coincide');
  });

  it('shows an error state with a working retry', () => {
    listReq().flush(
      { code: 'INTERNAL_ERROR', message: 'x', timestamp: 't' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-state')).toBeTruthy();
    fixture.nativeElement.querySelector('app-error-state button').click();
    listReq().flush(page(USERS));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  describe('staff provisioning (POST /api/admin/users)', () => {
    beforeEach(() => listReq().flush(page(USERS)));

    it('only offers the staff roles (never CLIENTE) and blocks an invalid email (UX)', () => {
      expect(component.provisionRoles).toEqual(['ASESOR', 'ADMINISTRADOR']);
      component.updateNewStaffEmail('not-an-email');
      component.provisionStaff();
      http.expectNone((r) => r.method === 'POST');
    });

    it('POSTs { email, role } and reloads the list on success', () => {
      component.updateNewStaffEmail(' nuevo@armakers3d.com ');
      component.updateNewStaffRole('ADMINISTRADOR');
      component.provisionStaff();
      const req = http.expectOne((r) => r.method === 'POST' && r.url === '/api/admin/users');
      expect(req.request.body).toEqual({ email: 'nuevo@armakers3d.com', role: 'ADMINISTRADOR' });
      req.flush(
        { id: 9, email: 'nuevo@armakers3d.com', role: 'ADMINISTRADOR', createdAt: '2026-10-06T10:00:00Z', active: true },
        { status: 201, statusText: 'Created' },
      );
      expect(component.provisionSuccess()).toContain('nuevo@armakers3d.com');
      listReq().flush(page(USERS));
    });

    it('explains 409 when the email already has an account', () => {
      component.updateNewStaffEmail('maria.gonzales@example.com');
      component.provisionStaff();
      http
        .expectOne((r) => r.method === 'POST')
        .flush({ code: 'CONFLICT', message: 'x', timestamp: 't' }, { status: 409, statusText: 'Conflict' });
      expect(component.provisionError()).toContain('Ya existe una cuenta');
    });
  });
});
