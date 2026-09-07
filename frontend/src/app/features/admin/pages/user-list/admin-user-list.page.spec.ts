import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminUserViewModel } from '../../models/admin-user.model';
import { AdminUsersMockService } from '../../services/admin-users-mock.service';
import { AdminUserListPage } from './admin-user-list.page';

/** Lightweight `ActivatedRoute` fake — mirrors `admin-product-list.page.spec.ts`'s narrow-mocking
 * convention: only exposes `queryParamMap` (this page reacts to `?mockState=`). */
function fakeActivatedRoute(queryParams: Record<string, string> = {}): Partial<ActivatedRoute> {
  const map: ParamMap = convertToParamMap(queryParams);
  return {
    queryParamMap: of(map),
    snapshot: { queryParamMap: map } as ActivatedRouteSnapshot,
  };
}

const USERS: AdminUserViewModel[] = [
  {
    id: 'usr-1',
    email: 'maria.gonzales@example.com',
    role: 'CLIENTE',
    memberSince: new Date('2025-01-14T15:20:00Z'),
    active: true,
  },
  {
    id: 'usr-2',
    email: 'asesor.andrea@armakers3d.com',
    role: 'ASESOR',
    memberSince: new Date('2024-11-05T09:00:00Z'),
    active: false,
  },
];

describe('AdminUserListPage', () => {
  let fixture: ComponentFixture<AdminUserListPage>;
  let component: AdminUserListPage;

  describe('with the real mock service', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AdminUserListPage],
        providers: [provideRouter([]), { provide: ActivatedRoute, useValue: fakeActivatedRoute() }],
      }).compileComponents();
    });

    it('renders the loading state immediately, before the mock delay resolves', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminUserListPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ui-state, [role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();

      tick(400);
    }));

    it('renders the seeded users in the table once loaded', fakeAsync(() => {
      fixture = TestBed.createComponent(AdminUserListPage);
      fixture.detectChanges();
      tick(400);
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('admin.principal@armakers3d.com');
      expect(text).toContain('Administrador');
      expect(text).toContain('Cliente');
    }));

    it('renders the empty state for ?mockState=empty', fakeAsync(() => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: fakeActivatedRoute({ mockState: 'empty' }),
      });
      fixture = TestBed.createComponent(AdminUserListPage);
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
      fixture = TestBed.createComponent(AdminUserListPage);
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

  describe('search and role filtering (test double service)', () => {
    let service: Partial<AdminUsersMockService>;

    beforeEach(async () => {
      service = {
        getUsers: (): Observable<AdminUserViewModel[]> => of([...USERS]),
      };

      await TestBed.configureTestingModule({
        imports: [AdminUserListPage],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
          { provide: AdminUsersMockService, useValue: service },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(AdminUserListPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('narrows visible rows by case-insensitive email search', () => {
      component.updateSearch('andrea');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('asesor.andrea@armakers3d.com');
      expect(text).not.toContain('maria.gonzales@example.com');
    });

    it('narrows visible rows by role', () => {
      component.updateRoleFilter('ASESOR');
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('asesor.andrea@armakers3d.com');
      expect(text).not.toContain('maria.gonzales@example.com');
    });
  });

  it('renders the error state when the initial fetch fails (test double service)', () => {
    const failingService: Partial<AdminUsersMockService> = {
      getUsers: (): Observable<AdminUserViewModel[]> => throwError(() => new Error('boom')),
    };

    TestBed.configureTestingModule({
      imports: [AdminUserListPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeActivatedRoute() },
        { provide: AdminUsersMockService, useValue: failingService },
      ],
    });
    fixture = TestBed.createComponent(AdminUserListPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});
