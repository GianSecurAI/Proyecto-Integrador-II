import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SessionStateService } from '../../../core/services/session-state.service';
import { AuthMockService } from './auth-preview.service';

describe('AuthMockService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('completes only the in-memory preview without HTTP, storage or real session changes', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    const session = TestBed.inject(SessionStateService);
    const mark = spyOn(session, 'markAuthenticated');
    const local = spyOn(Storage.prototype, 'setItem');
    const historyWrite = spyOn(history, 'pushState');
    mock.requestOtp().subscribe();
    tick(500);
    expect(mock.hasPendingRequest()).toBeTrue();
    let completed = false;
    mock.verifyOtp().subscribe(() => (completed = true));
    tick(500);
    expect(completed).toBeTrue();
    expect(mock.hasPendingRequest()).toBeFalse();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(mark).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
    expect(historyWrite).not.toHaveBeenCalled();
  }));
  it('does not simulate verification before a request', () => {
    let failed = false;
    TestBed.inject(AuthMockService)
      .verifyOtp()
      .subscribe({ error: () => (failed = true) });
    expect(failed).toBeTrue();
  });
  it('does not create delayed state when a pending request is cancelled', fakeAsync(() => {
    const mock = TestBed.inject(AuthMockService);
    const subscription = mock.requestOtp().subscribe();
    subscription.unsubscribe();
    tick(500);
    expect(mock.hasPendingRequest()).toBeFalse();
  }));
});
