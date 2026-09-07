import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ShellComponent } from './shell.component';

@Component({ standalone: true, template: '<p>public page</p>' })
class StubPublicPage {}

@Component({ standalone: true, template: '<p>admin page</p>' })
class StubAdminPage {}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([
          { path: '', component: StubPublicPage },
          { path: 'admin', children: [{ path: '**', component: StubAdminPage }] },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShellComponent);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders the header, the routed-content region, and the footer together on a public route', async () => {
    await router.navigateByUrl('/');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-footer')).toBeTruthy();
  });

  it('hides the public header and footer under /admin, since the admin feature supplies its own chrome', async () => {
    await router.navigateByUrl('/admin/anything');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-footer')).toBeNull();
    // The skip-link target region must still exist regardless of which chrome is shown.
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
  });

  it('does not render its own <main> element, since every routed page renders its own', async () => {
    // HTML forbids two <main> landmarks; each routed page (auth pages, status pages, the admin
    // shell) already has one. The skip-link target here must be a plain container, not another
    // <main>.
    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
  });

  it('provides a skip link targeting the main content region', () => {
    const skipLink: HTMLAnchorElement = fixture.nativeElement.querySelector('.skip-link');
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });
});
