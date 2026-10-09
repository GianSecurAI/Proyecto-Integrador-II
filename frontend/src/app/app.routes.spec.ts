import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStateService } from './core/services/session-state.service';
import { routes } from './app.routes';

/**
 * Minimal routing-level check (not a full re-test of app.routes.ts): confirms `/account`'s
 * children resolve to the right lazy component for the RF-04 profile default view and the
 * RF-05/RF-12/RF-14 order-history/order-detail screens added alongside this change (the parent
 * `account` route itself no longer has a `loadComponent` — it only holds the shared
 * `authGuard`/`role: 'CLIENTE'` and dispatches to its children).
 */
/**
 * Public, unauthenticated static content routes (footer "Políticas"/"Información del contacto"
 * links) added alongside `features/legal/` — confirms each resolves to the right lazy component
 * with no guard.
 */
describe('app.routes — /legal', () => {
  const legalRoutes: { path: string; name: string }[] = [
    { path: 'legal/privacidad', name: 'PrivacyPolicyPage' },
    { path: 'legal/reembolso', name: 'RefundPolicyPage' },
    { path: 'legal/terminos', name: 'TermsOfServicePage' },
    { path: 'legal/envio', name: 'ShippingPolicyPage' },
    { path: 'legal/contacto', name: 'ContactInfoPage' },
  ];

  for (const { path, name } of legalRoutes) {
    it(`loads ${name} for /${path}, unguarded`, async () => {
      const route = routes.find((r) => r.path === path);
      expect(route?.loadComponent).toBeTruthy();
      expect(route?.canActivate).toBeFalsy();

      const loaded = await route!.loadComponent!();
      expect((loaded as { name: string }).name).toMatch(new RegExp(`^${name}`));
    });
  }
});

describe('app.routes', () => {
  const accountRoute = () => routes.find((route) => route.path === 'account');

  it('loads ProfilePage for the default /account child route', async () => {
    const defaultChild = accountRoute()?.children?.find((child) => child.path === '');
    expect(defaultChild?.loadComponent).toBeTruthy();

    const loaded = await defaultChild!.loadComponent!();
    // Production bundling may mangle the class name (e.g. `ProfilePage2`) when another chunk
    // declares a same-named class, so this only asserts the recognizable prefix survives.
    expect((loaded as { name: string }).name).toMatch(/^ProfilePage/);
  });

  it('loads OrderHistoryPage for /account/orders', async () => {
    const ordersChild = accountRoute()?.children?.find((child) => child.path === 'orders');
    expect(ordersChild?.loadComponent).toBeTruthy();

    const loaded = await ordersChild!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^OrderHistoryPage/);
  });

  it('loads OrderDetailPage for /account/orders/:id', async () => {
    const detailChild = accountRoute()?.children?.find((child) => child.path === 'orders/:id');
    expect(detailChild?.loadComponent).toBeTruthy();

    const loaded = await detailChild!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^OrderDetailPage/);
  });

  it('loads IncidentsPage for /account/incidents', async () => {
    const incidentsChild = accountRoute()?.children?.find((child) => child.path === 'incidents');
    expect(incidentsChild?.loadComponent).toBeTruthy();

    const loaded = await incidentsChild!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^IncidentsPage/);
  });

  it('keeps the same guard and role on the parent /account route', () => {
    const route = accountRoute();
    expect(route?.canActivate).toBeTruthy();
    expect(route?.data?.['role']).toEqual(['CLIENTE']);
  });
});

/**
 * Covers the `/admin` route tree added for the admin visual-foundation task
 * (features/admin/). A full re-test of `authGuard`'s own redirect/role-check logic isn't
 * needed here — `core/guards/auth.guard.spec.ts` already covers that generically; this only
 * confirms the guard is wired with the right role and that each child path resolves to the
 * expected lazy component.
 */
describe('app.routes — /admin', () => {
  const adminRoute = () => routes.find((route) => route.path === 'admin');

  it('guards the parent /admin route with authGuard and role: [ADMINISTRADOR, ASESOR, RESPONSABLE_TI]', () => {
    const route = adminRoute();
    expect(route?.canActivate).toBeTruthy();
    expect(route?.data?.['role']).toEqual(['ADMINISTRADOR', 'ASESOR', 'RESPONSABLE_TI']);
  });

  it('loads AdminShellComponent for the parent /admin route', async () => {
    const route = adminRoute();
    expect(route?.loadComponent).toBeTruthy();
    const loaded = await route!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminShellComponent/);
  });

  it('redirects the default /admin child to orders (reachable by both ADMINISTRADOR and ASESOR — regression check for the bare-/admin bug)', () => {
    const defaultChild = adminRoute()?.children?.find((child) => child.path === '');
    // role-aware redirect: orders for the staff roles, monitoring for the IT officer (who cannot enter orders)
    expect(typeof defaultChild?.redirectTo).toBe('function');
    // The redirect target itself must NOT be Administrador-only, otherwise an Asesor landing on
    // bare /admin would still bounce to /forbidden.
    const ordersChild = adminRoute()?.children?.find((c) => c.path === 'orders');
    expect(ordersChild?.data?.['role']).toEqual(['ADMINISTRADOR', 'ASESOR']);
    expect(ordersChild?.canActivate).toBeTruthy(); // its own guard keeps the IT officer out
  });

  it('loads AdminProductListPage for /admin/products, re-restricted to ADMINISTRADOR', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'products');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminProductListPage/);
  });

  it('loads AdminProductCreatePage for /admin/products/new, re-restricted to ADMINISTRADOR', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'products/new');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminProductCreatePage/);
  });

  it('loads AdminProductDetailPage for /admin/products/:id, re-restricted to ADMINISTRADOR', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'products/:id');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminProductDetailPage/);
  });

  it('loads AdminOrderListPage for /admin/orders, restricted to [ADMINISTRADOR, ASESOR]', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'orders');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR', 'ASESOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminOrderListPage/);
  });

  it('loads AdminRegisterPersonalizedOrderPage for /admin/orders/register-personalized', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'orders/register-personalized');
    expect(child?.loadComponent).toBeTruthy();
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminRegisterPersonalizedOrderPage/);
  });

  it('loads AdminOrderDetailPage for /admin/orders/:id', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'orders/:id');
    expect(child?.loadComponent).toBeTruthy();
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminOrderDetailPage/);
  });

  it('loads AdminIncidentListPage for /admin/incidents, restricted to [ADMINISTRADOR, ASESOR]', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'incidents');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR', 'ASESOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminIncidentListPage/);
  });

  it('loads AdminIncidentDetailPage for /admin/incidents/:id', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'incidents/:id');
    expect(child?.loadComponent).toBeTruthy();
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminIncidentDetailPage/);
  });

  it('guards /admin/quotations (list, new, detail) to the staff roles', async () => {
    for (const path of ['quotations', 'quotations/new', 'quotations/:id']) {
      const child = adminRoute()?.children?.find((c) => c.path === path);
      expect(child?.canActivate).withContext(path).toBeTruthy();
      expect(child?.data?.['role']).withContext(path).toEqual(['ADMINISTRADOR', 'ASESOR']);
    }
    const detail = adminRoute()?.children?.find((c) => c.path === 'quotations/:id');
    const loaded = await detail!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminQuotationDetailPage/);
  });

  it('guards /admin/monitoring to the IT officer and the administrator', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'monitoring');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR', 'RESPONSABLE_TI']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminMonitoringPage/);
  });

  it('keeps the order and incident screens out of reach of the IT officer', () => {
    for (const path of ['orders', 'orders/:id', 'orders/register-personalized', 'incidents', 'incidents/:id']) {
      const child = adminRoute()?.children?.find((c) => c.path === path);
      expect(child?.canActivate).withContext(path).toBeTruthy();
      expect(child?.data?.['role']).withContext(path).not.toContain('RESPONSABLE_TI');
    }
  });

  it('loads AdminReportsPage for /admin/reports', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'reports');
    expect(child?.loadComponent).toBeTruthy();

    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminReportsPage/);
  });

  it('loads AdminUserListPage for /admin/users, re-restricted to ADMINISTRADOR', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'users');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminUserListPage/);
  });

  it('loads AdminUserDetailPage for /admin/users/:id, re-restricted to ADMINISTRADOR', async () => {
    const child = adminRoute()?.children?.find((c) => c.path === 'users/:id');
    expect(child?.canActivate).toBeTruthy();
    expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    const loaded = await child!.loadComponent!();
    expect((loaded as { name: string }).name).toMatch(/^AdminUserDetailPage/);
  });

  it('loads the payment verification pages (FE-11) re-restricted to ADMINISTRADOR (no ASESOR)', async () => {
    const list = adminRoute()?.children?.find((c) => c.path === 'payments');
    const detail = adminRoute()?.children?.find((c) => c.path === 'payments/:id');
    expect(list?.data?.['role']).toEqual(['ADMINISTRADOR']);
    expect(detail?.data?.['role']).toEqual(['ADMINISTRADOR']);
    expect(list?.canActivate).toBeTruthy();
    expect(detail?.canActivate).toBeTruthy();
    expect(((await list!.loadComponent!()) as { name: string }).name).toMatch(/^AdminPaymentListPage/);
    expect(((await detail!.loadComponent!()) as { name: string }).name).toMatch(/^AdminPaymentDetailPage/);
  });

  for (const path of ['reports', 'users', 'users/:id', 'payments', 'payments/:id']) {
    it(`re-restricts /admin/${path} to ADMINISTRADOR alone`, () => {
      const child = adminRoute()?.children?.find((c) => c.path === path);
      expect(child?.canActivate).toBeTruthy();
      expect(child?.data?.['role']).toEqual(['ADMINISTRADOR']);
    });
  }
});

/**
 * End-to-end (real `Router` + real `routes` array, not just the guard in isolation) regression
 * coverage for the bare-`/admin` default-redirect bug: before staff OTP login existed, nothing
 * could ever reach this path as ASESOR, so the fact that `redirectTo: 'products'` sent an Asesor
 * straight into an Administrador-only route was never observable. `core/guards/auth.guard.spec.ts`
 * already covers the guard's role-check logic generically; this instead proves the FULL bare
 * `/admin` navigation now lands somewhere each staff role can actually reach.
 */
describe('app.routes — /admin default redirect (staff auth integration)', () => {
  let router: Router;
  let session: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStateService);
  });

  it('lets an ASESOR session land on /admin/orders via the bare /admin redirect', async () => {
    session.markAuthenticated('ASESOR', 'asesor.andrea@armakers3d.com');

    await router.navigateByUrl('/admin');

    expect(router.url).toBe('/admin/orders');
  });

  it('lets an ADMINISTRADOR session land on /admin/orders via the bare /admin redirect', async () => {
    session.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');

    await router.navigateByUrl('/admin');

    expect(router.url).toBe('/admin/orders');
  });

  it('still redirects a CLIENTE session away from /admin to /forbidden (not a staff route)', async () => {
    session.markAuthenticated('CLIENTE', 'customer@example.com');

    await router.navigateByUrl('/admin');

    expect(router.url).toBe('/forbidden');
  });
});

describe('app.routes — checkout payment page (ADR-005)', () => {
  let router: Router;
  let session: SessionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStateService);
  });

  it('/checkout/confirmacion is guarded for CLIENTE and keeps ?checkoutId= as returnUrl through the login', async () => {
    const route = routes.find((r) => r.path === 'checkout/confirmacion');
    expect(route?.canActivate).toBeTruthy();
    expect(route?.data?.['role']).toEqual(['CLIENTE']);

    session.clear();
    await router.navigateByUrl('/checkout/confirmacion?checkoutId=abc');
    expect(router.url).toContain('/auth/request-code');
    expect(decodeURIComponent(router.url)).toContain('returnUrl=/checkout/confirmacion?checkoutId=abc');
  });

  it('a staff session is sent to /forbidden', async () => {
    session.markAuthenticated('ASESOR');
    await router.navigateByUrl('/checkout/confirmacion?checkoutId=abc');
    expect(router.url).toBe('/forbidden');
  });

  it('an ASESOR cannot reach /admin/payments', async () => {
    session.markAuthenticated('ASESOR');
    await router.navigateByUrl('/admin/payments');
    expect(router.url).toBe('/forbidden');
  });
});
