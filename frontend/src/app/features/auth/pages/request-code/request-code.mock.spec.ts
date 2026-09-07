import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RequestCodePage } from './request-code.page';

describe('Login visual preview', () => {
  it('requests the mock step without any HTTP request or navigation data', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [RequestCodePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(RequestCodePage);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.emailControl.setValue('customer@example.com');
    fixture.componentInstance.submit();
    tick(600);
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-code']);
  }));
});
