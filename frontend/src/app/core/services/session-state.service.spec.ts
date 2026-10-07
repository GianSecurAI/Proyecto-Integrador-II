import { TestBed } from '@angular/core/testing';
import { SessionStateService } from './session-state.service';

/**
 * No dedicated spec existed for this service before the staff-auth widening task — its
 * `markAuthenticated`/`clear` behavior was previously only exercised indirectly through
 * `auth.guard.spec.ts`/`auth.service.spec.ts`. This file covers the service directly, including
 * the new `authStatus`/`currentEmail` surface added by that task.
 */
describe('SessionStateService', () => {
  let service: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionStateService);
  });

  it('starts signed out, with no role/email/id and a "checking" status until GET /api/auth/me settles', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentRole()).toBeNull();
    expect(service.currentEmail()).toBeNull();
    expect(service.currentUserId()).toBeNull();
    expect(service.authStatus()).toBe('checking');
  });

  it('records the server-assigned user id and forgets it on clear()', () => {
    service.markAuthenticated('CLIENTE', 'c@x.pe', 42);
    expect(service.currentUserId()).toBe(42);
    service.clear();
    expect(service.currentUserId()).toBeNull();
    expect(service.authStatus()).toBe('anonymous');
  });

  it('marks authenticated with a default CLIENTE role when none is given (back-compat for existing callers)', () => {
    service.markAuthenticated();

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.currentRole()).toBe('CLIENTE');
    expect(service.currentEmail()).toBeNull();
    expect(service.authStatus()).toBe('authenticated');
  });

  it('records the role and email supplied to markAuthenticated', () => {
    service.markAuthenticated('ASESOR', 'asesor.andrea@armakers3d.com');

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.currentRole()).toBe('ASESOR');
    expect(service.currentEmail()).toBe('asesor.andrea@armakers3d.com');
  });

  it('records an ADMINISTRADOR role and email', () => {
    service.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');

    expect(service.currentRole()).toBe('ADMINISTRADOR');
    expect(service.currentEmail()).toBe('admin.principal@armakers3d.com');
  });

  it('clear() resets to the same anonymous shape as a fresh instance, not a partial/inconsistent state', () => {
    service.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');

    service.clear();

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentRole()).toBeNull();
    expect(service.currentEmail()).toBeNull();
    expect(service.authStatus()).toBe('anonymous');
  });

  it('never persists anything to localStorage or sessionStorage', () => {
    const local = spyOn(Storage.prototype, 'setItem');

    service.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');
    service.clear();

    expect(local).not.toHaveBeenCalled();
  });
});
