import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccountNavComponent } from './account-nav.component';

/** Thin routed host so `RouterTestingHarness` has an actual page component to navigate to while
 * exercising the real `Router` (needed for `routerLinkActive` to reflect the current URL) —
 * `AccountNavComponent` itself is never directly routed, only embedded by `ProfilePage` and
 * `OrderHistoryPage`. */
@Component({ standalone: true, imports: [AccountNavComponent], template: '<app-account-nav />' })
class HostPage {}

describe('AccountNavComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'account', component: HostPage },
          { path: 'account/orders', component: HostPage },
          { path: 'account/incidents', component: HostPage },
        ]),
      ],
    }),
  );

  it('renders links to /account, /account/orders and /account/incidents', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/account', HostPage);
    const links: HTMLAnchorElement[] = Array.from(
      harness.routeNativeElement!.querySelectorAll('a'),
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/account',
      '/account/orders',
      '/account/incidents',
    ]);
  });

  it('marks the "Perfil" link active only on the exact /account path', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/account/orders', HostPage);
    const activeLinks = harness.routeNativeElement!.querySelectorAll('.account-nav__link--active');
    expect(activeLinks.length).toBe(1);
    expect((activeLinks[0] as HTMLElement).textContent).toContain('Mis pedidos');
  });
});
