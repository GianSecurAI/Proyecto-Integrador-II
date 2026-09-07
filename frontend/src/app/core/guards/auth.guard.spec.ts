import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { SessionStateService } from '../services/session-state.service';

/**
 * Covers the auth guard's redirect logic per the parent task's requirement to test "the auth
 * guard's redirect logic" (Constitution Principle XI). Runs the guard function directly inside
 * an injection context (`TestBed.runInInjectionContext`) rather than through a real route
 * navigation, since the guard's job is a pure decision based on `SessionStateService` — no
 * HTTP, no component rendering involved.
 */
describe('authGuard', () => {
  let session: SessionStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStateService);
    router = TestBed.inject(Router);
  });

  function runGuard(routeData: Record<string, unknown> = {}) {
    const snapshot = { data: routeData, pathFromRoot: [] } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(snapshot, {} as never));
  }

  it('redirects an unauthenticated visitor to the request-code page', () => {
    session.clear();

    const result = runGuard() as UrlTree;

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/auth/request-code');
  });

  it('allows an authenticated customer through when no specific role is required', () => {
    session.markAuthenticated('CLIENTE');

    const result = runGuard();

    expect(result).toBe(true);
  });

  it('allows an authenticated customer through a route requiring the matching role', () => {
    session.markAuthenticated('CLIENTE');

    const result = runGuard({ role: 'CLIENTE' });

    expect(result).toBe(true);
  });

  it('redirects an authenticated session with the wrong role to the forbidden page', () => {
    session.markAuthenticated('CLIENTE');

    const result = runGuard({ role: 'ADMINISTRADOR' }) as UrlTree;

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/forbidden');
  });

  it('allows a session whose role is included in an array of allowed roles', () => {
    session.markAuthenticated('ASESOR');

    const result = runGuard({ role: ['ADMINISTRADOR', 'ASESOR'] });

    expect(result).toBe(true);
  });

  it('allows an ADMINISTRADOR session through the same array-role route', () => {
    session.markAuthenticated('ADMINISTRADOR');

    const result = runGuard({ role: ['ADMINISTRADOR', 'ASESOR'] });

    expect(result).toBe(true);
  });

  it('redirects a session whose role is not in the array of allowed roles', () => {
    session.markAuthenticated('CLIENTE');

    const result = runGuard({ role: ['ADMINISTRADOR', 'ASESOR'] }) as UrlTree;

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/forbidden');
  });

  it('redirects an ASESOR session on a route that requires ADMINISTRADOR alone', () => {
    session.markAuthenticated('ASESOR');

    const result = runGuard({ role: 'ADMINISTRADOR' }) as UrlTree;

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/forbidden');
  });

  it('treats a never-established session (never marked, never cleared) exactly like anonymous — no crash, redirect to request-code', () => {
    // Deliberately no `session.clear()`/`markAuthenticated()` call: a fresh service instance's
    // default state must already behave like "anonymous", not an inconsistent in-between state.
    const result = runGuard() as UrlTree;

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/auth/request-code');
  });

  it('denies access to a previously-reachable route after logout (session.clear())', () => {
    session.markAuthenticated('ADMINISTRADOR');
    expect(runGuard({ role: ['ADMINISTRADOR', 'ASESOR'] })).toBe(true);

    session.clear();

    const result = runGuard({ role: ['ADMINISTRADOR', 'ASESOR'] }) as UrlTree;
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/auth/request-code');
  });
});
