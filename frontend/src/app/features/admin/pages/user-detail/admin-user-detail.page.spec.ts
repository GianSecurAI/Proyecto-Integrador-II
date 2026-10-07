import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { AdminUserDetailPage } from './admin-user-detail.page';

function fakeActivatedRoute(id: string): Partial<ActivatedRoute> {
  const params: ParamMap = convertToParamMap({ id });
  return { paramMap: of(params), snapshot: { paramMap: params } as ActivatedRouteSnapshot };
}

/** Shape copied from backend `AdminUserDto`. */
function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    email: 'maria.gonzales@example.com',
    role: 'CLIENTE',
    createdAt: '2025-01-14T15:20:00Z',
    active: true,
    ...overrides,
  };
}

describe('AdminUserDetailPage (GET/PATCH /api/admin/users/{id})', () => {
  let fixture: ComponentFixture<AdminUserDetailPage>;
  let component: AdminUserDetailPage;
  let http: HttpTestingController;
  const url = '/api/admin/users/7';

  function create(id = '7') {
    TestBed.configureTestingModule({
      imports: [AdminUserDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  function load(body: object = user()) {
    http.expectOne(url).flush(body);
    fixture.detectChanges();
  }

  it('renders the user fields from the server', () => {
    create();
    load();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('maria.gonzales@example.com');
    expect(text).toContain('Cliente');
    expect(text).toContain('Activo');
    expect(text).not.toContain('Vista de demostración');
  });

  it('selecting a different role opens the confirmation dialog and only PATCHes after confirming', () => {
    create();
    load();
    component.updateSelectedRole('ASESOR');
    component.requestRoleChange();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    http.expectNone(`${url}/role`);

    component.confirmPendingAction();
    const req = http.expectOne(`${url}/role`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ASESOR' });
    req.flush(user({ role: 'ASESOR' }));
    fixture.detectChanges();
    expect(component.user()?.role).toBe('ASESOR');
    expect(component.roleSuccess()).toContain('actualizó');
  });

  it('does not call the API when the dialog is cancelled or the same role is re-selected', () => {
    create();
    load();
    component.updateSelectedRole('ADMINISTRADOR');
    component.requestRoleChange();
    component.cancelPendingAction();
    component.updateSelectedRole('CLIENTE');
    component.requestRoleChange();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    http.expectNone(`${url}/role`);
  });

  it('deactivating needs confirmation and PATCHes { active: false }', () => {
    create();
    load();
    component.requestDeactivate();
    http.expectNone(`${url}/active`);
    component.confirmPendingAction();
    const req = http.expectOne(`${url}/active`);
    expect(req.request.body).toEqual({ active: false });
    req.flush(user({ active: false }));
    expect(component.user()?.active).toBeFalse();
  });

  it('reactivating PATCHes { active: true } immediately, with no dialog', () => {
    create();
    load(user({ active: false }));
    component.activate();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    const req = http.expectOne(`${url}/active`);
    expect(req.request.body).toEqual({ active: true });
    req.flush(user({ active: true }));
  });

  it('explains 409 SELF_MODIFICATION_NOT_ALLOWED when changing the own role', () => {
    create();
    load();
    component.updateSelectedRole('ASESOR');
    component.requestRoleChange();
    component.confirmPendingAction();
    http
      .expectOne(`${url}/role`)
      .flush(
        { code: 'SELF_MODIFICATION_NOT_ALLOWED', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.roleError()).toContain('tu propio rol');
    expect(component.user()?.role).toBe('CLIENTE');
  });

  it('explains 409 LAST_ADMINISTRATOR when deactivating the only administrator', () => {
    create();
    load(user({ role: 'ADMINISTRADOR' }));
    component.requestDeactivate();
    component.confirmPendingAction();
    http
      .expectOne(`${url}/active`)
      .flush(
        { code: 'LAST_ADMINISTRATOR', message: 'x', timestamp: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.activeError()).toContain('al menos un administrador');
    expect(component.user()?.active).toBeTrue();
  });

  it('shows not-found on 404 and for a non-numeric id (without calling the API)', () => {
    create();
    http
      .expectOne(url)
      .flush({ code: 'NOT_FOUND', message: 'x', timestamp: 't' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Usuario no encontrado');
    TestBed.resetTestingModule();
    create('abc');
    expect(fixture.nativeElement.textContent).toContain('Usuario no encontrado');
    http.expectNone((r) => r.url.startsWith('/api/admin/users'));
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
    expect(fixture.nativeElement.textContent).toContain('maria.gonzales@example.com');
  });
});
