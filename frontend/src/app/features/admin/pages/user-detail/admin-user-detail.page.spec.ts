import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminUserViewModel } from '../../models/admin-user.model';
import { AdminUsersMockService } from '../../services/admin-users-mock.service';
import { AdminUserDetailPage } from './admin-user-detail.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-product-detail.page.spec.ts`'s narrow-mocking
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

const USER: AdminUserViewModel = {
  id: 'usr-1',
  email: 'maria.gonzales@example.com',
  role: 'CLIENTE',
  memberSince: new Date('2025-01-14T15:20:00Z'),
  active: true,
};

function configureWithService(id: string, service: Partial<AdminUsersMockService>) {
  TestBed.configureTestingModule({
    imports: [AdminUserDetailPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: fakeActivatedRoute(id) },
      { provide: AdminUsersMockService, useValue: service },
    ],
  });
}

describe('AdminUserDetailPage', () => {
  let fixture: ComponentFixture<AdminUserDetailPage>;
  let component: AdminUserDetailPage;

  it('renders the user fields correctly', fakeAsync(() => {
    const service: Partial<AdminUsersMockService> = { getUserById: () => of(USER) };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('maria.gonzales@example.com');
    expect(text).toContain('Cliente');
    expect(text).toContain('Activo');
  }));

  it('selecting a different role and confirming calls changeRole with the right value', fakeAsync(() => {
    const changeRole = jasmine
      .createSpy('changeRole')
      .and.returnValue(of({ ...USER, role: 'ASESOR' as const }));
    const service: Partial<AdminUsersMockService> = {
      getUserById: () => of(USER),
      changeRole,
    };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.updateSelectedRole('ASESOR');
    component.requestRoleChange();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(changeRole).not.toHaveBeenCalled();

    component.confirmPendingAction();
    fixture.detectChanges();

    expect(changeRole).toHaveBeenCalledOnceWith('usr-1', 'ASESOR');
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  }));

  it('does NOT call changeRole when the role-change dialog is cancelled', fakeAsync(() => {
    const changeRole = jasmine.createSpy('changeRole');
    const service: Partial<AdminUsersMockService> = { getUserById: () => of(USER), changeRole };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.updateSelectedRole('ADMINISTRADOR');
    component.requestRoleChange();
    fixture.detectChanges();
    component.cancelPendingAction();
    fixture.detectChanges();

    expect(changeRole).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  }));

  it('selecting the same role as current is a no-op: no dialog, no call', fakeAsync(() => {
    const changeRole = jasmine.createSpy('changeRole');
    const service: Partial<AdminUsersMockService> = { getUserById: () => of(USER), changeRole };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.updateSelectedRole('CLIENTE');
    component.requestRoleChange();
    fixture.detectChanges();

    expect(changeRole).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  }));

  it('deactivating opens the dialog and only calls setActive(id, false) after confirming', fakeAsync(() => {
    const setActive = jasmine
      .createSpy('setActive')
      .and.returnValue(of({ ...USER, active: false }));
    const service: Partial<AdminUsersMockService> = { getUserById: () => of(USER), setActive };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.requestDeactivate();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(setActive).not.toHaveBeenCalled();

    component.confirmPendingAction();
    fixture.detectChanges();

    expect(setActive).toHaveBeenCalledOnceWith('usr-1', false);
  }));

  it('reactivating calls setActive(id, true) immediately, no dialog', fakeAsync(() => {
    const inactiveUser: AdminUserViewModel = { ...USER, active: false };
    const setActive = jasmine
      .createSpy('setActive')
      .and.returnValue(of({ ...inactiveUser, active: true }));
    const service: Partial<AdminUsersMockService> = {
      getUserById: () => of(inactiveUser),
      setActive,
    };
    configureWithService(USER.id, service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    component.activate();
    fixture.detectChanges();

    expect(setActive).toHaveBeenCalledOnceWith('usr-1', true);
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  }));

  it('shows a not-found state for an unknown user id (real state, not simulated)', fakeAsync(() => {
    const service: Partial<AdminUsersMockService> = {
      getUserById: () => throwError(() => new Error('not found')),
    };
    configureWithService('no-existe', service);
    fixture = TestBed.createComponent(AdminUserDetailPage);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usuario no encontrado');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-empty-state a');
    expect(link.getAttribute('href')).toBe('/admin/users');
  }));

  it('shows the error state with a working retry for ?mockState=error', fakeAsync(() => {
    let callCount = 0;
    const service: Partial<AdminUsersMockService> = {
      getUserById: (): Observable<AdminUserViewModel> => {
        callCount++;
        return throwError(() => new Error('boom'));
      },
    };
    TestBed.configureTestingModule({
      imports: [AdminUserDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute(USER.id, { mockState: 'error' }) },
        { provide: AdminUsersMockService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(AdminUserDetailPage);
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
    expect(callCount).toBe(2);
  }));
});
