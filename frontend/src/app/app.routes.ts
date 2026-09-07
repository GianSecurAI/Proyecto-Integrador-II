import { Routes } from '@angular/router';
import { ADMIN_ONLY_ROLES, CUSTOMER_ROLES, STAFF_ROLES } from './core/auth/roles';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/pages/home/home.page').then((m) => m.HomePage),
    title: 'Ar Makers 3D — Impresión 3D personalizada',
  },
  {
    path: 'catalog',
    loadComponent: () =>
      import('./features/catalog/pages/catalog/catalog.page').then((m) => m.CatalogPage),
    title: 'Catálogo — Ar Makers 3D',
  },
  {
    path: 'catalog/:id',
    loadComponent: () =>
      import('./features/catalog/pages/product-detail/product-detail.page').then(
        (m) => m.ProductDetailPage,
      ),
    title: 'Detalle del producto — Ar Makers 3D',
  },
  {
    // Standard-catalog self-service cart (CLAUDE.md's "Business clarification: purchasing
    // flows") — public, unguarded: a guest may build a cart before ever signing in, consistent
    // with the real-world flow (add to cart -> checkout -> pay, login relevant only at/after
    // that point). Never reached by the advisor-mediated WhatsApp custom-order flow.
    path: 'cart',
    loadComponent: () => import('./features/cart/pages/cart/cart.page').then((m) => m.CartPage),
    title: 'Carrito de compras — Ar Makers 3D',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // Public, unauthenticated order-tracking entry point (RF-12), distinct from the
    // authenticated customer's own order list under `/account/orders` — see
    // `features/order-tracking/pages/track-order/track-order.page.ts` for the full rationale.
    // Deliberately NOT nested under `/account` and NOT guarded.
    path: 'track-order',
    loadComponent: () =>
      import('./features/order-tracking/pages/track-order/track-order.page').then(
        (m) => m.TrackOrderPage,
      ),
    title: 'Rastrea tu pedido — Ar Makers 3D',
  },
  {
    // Parent-level guard/role so both the profile default view and the RF-05/RF-12/RF-14 order
    // screens share one authorization boundary (docs/discovery/04-printcrate-adaptation.md §A6
    // recommends grouping profile + order history as sub-routes of one `account` feature).
    path: 'account',
    canActivate: [authGuard],
    data: { role: CUSTOMER_ROLES },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/account/pages/profile/profile.page').then((m) => m.ProfilePage),
        title: 'Tu perfil — Ar Makers 3D',
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/account/pages/order-history/order-history.page').then(
            (m) => m.OrderHistoryPage,
          ),
        title: 'Mis pedidos — Ar Makers 3D',
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./features/account/pages/order-detail/order-detail.page').then(
            (m) => m.OrderDetailPage,
          ),
        title: 'Detalle del pedido — Ar Makers 3D',
      },
      {
        // RF-15 ("Registro de incidencias", actor Cliente) — same authorization boundary as the
        // rest of the `account` feature; see `features/account/pages/incidents/incidents.page.ts`.
        path: 'incidents',
        loadComponent: () =>
          import('./features/account/pages/incidents/incidents.page').then(
            (m) => m.IncidentsPage,
          ),
        title: 'Incidencias — Ar Makers 3D',
      },
    ],
  },
  {
    // Admin panel shell (features/admin/) — houses both the Administrador-only screens
    // (products/reports/users) and the staff screens shared with Asesor (orders — RF-13;
    // incidents — RF-16/17/18). Guarded like `/account` above, but with `role: STAFF_ROLES`
    // (`['ADMINISTRADOR', 'ASESOR']`, `core/auth/roles.ts`) — both staff roles may enter the admin
    // shell now that Asesor has approved capabilities within it (RF-11/RF-13). The same OTP flow
    // used by customers now resolves a staff role after verification (see
    // `features/auth/pages/verify-code/verify-code.page.ts`), so this route is genuinely
    // reachable in the running preview (still no fake "staff session" bypass — role is only ever
    // discovered from a real, if mocked, OTP verification; see `SessionStateService`/`authGuard`).
    // `loadComponent` here supplies the admin-only chrome (topbar + sidebar) that replaces the
    // public header/footer under this path (see `layout/shell/shell.component.ts`'s
    // `isAdminArea` signal).
    //
    // Because the PARENT is reachable by both staff roles, the three domains confirmed
    // Administrador-ONLY by their own requirement grounding (products — RF-07; reports — RF-19,
    // "exclusivos para Administrador"; users — RF-03, role management) each carry their OWN
    // stricter child-level guard below (`role: ADMIN_ONLY_ROLES`) so Asesor cannot reach them as a
    // side effect of the parent widening. `orders`/`quotations`/`incidents` need no extra guard —
    // they correctly, and intentionally, inherit the parent's broader `STAFF_ROLES`.
    path: 'admin',
    canActivate: [authGuard],
    data: { role: STAFF_ROLES },
    loadComponent: () =>
      import('./features/admin/layout/admin-shell/admin-shell.component').then(
        (m) => m.AdminShellComponent,
      ),
    children: [
      // Bare `/admin` must redirect to a domain BOTH staff roles can reach — `orders` (RF-13),
      // not `products` (Administrador-ONLY, RF-07). This was a latent bug before any admin/advisor
      // authentication flow existed to reach it: an Asesor landing on bare `/admin` would have
      // been redirected straight into a route they cannot access and immediately bounced to
      // `/forbidden`. Now that staff OTP login makes `/admin` genuinely reachable
      // (`features/auth/pages/verify-code/verify-code.page.ts`), this is fixed.
      { path: '', pathMatch: 'full', redirectTo: 'orders' },
      {
        // The one domain (RF-07/HU06 "Gestionar catálogo de productos") with a real feature
        // implementation — list/detail/create — instead of the generic placeholder used by the
        // other five domains below. See `pages/product-list/admin-product-list.page.ts`'s doc
        // comment for the full requirement grounding. Administrador-ONLY — see the parent route's
        // doc comment above.
        path: 'products',
        canActivate: [authGuard],
        data: { role: ADMIN_ONLY_ROLES },
        loadComponent: () =>
          import('./features/admin/pages/product-list/admin-product-list.page').then(
            (m) => m.AdminProductListPage,
          ),
        title: 'Productos — Administración — Ar Makers 3D',
      },
      {
        // Must be registered BEFORE 'products/:id' so the literal segment 'new' does not get
        // captured by the ':id' param route. Administrador-ONLY, same as 'products' above.
        path: 'products/new',
        canActivate: [authGuard],
        data: { role: ADMIN_ONLY_ROLES },
        loadComponent: () =>
          import('./features/admin/pages/product-create/admin-product-create.page').then(
            (m) => m.AdminProductCreatePage,
          ),
        title: 'Nuevo producto — Administración — Ar Makers 3D',
      },
      {
        // Administrador-ONLY, same as 'products' above.
        path: 'products/:id',
        canActivate: [authGuard],
        data: { role: ADMIN_ONLY_ROLES },
        loadComponent: () =>
          import('./features/admin/pages/product-detail/admin-product-detail.page').then(
            (m) => m.AdminProductDetailPage,
          ),
        title: 'Detalle del producto — Administración — Ar Makers 3D',
      },
      {
        // RF-13 ("Gestión de los estados del pedido") staff order list — actor Administrador/
        // Asesor, see `pages/order-list/admin-order-list.page.ts`'s doc comment. Inherits the
        // parent's `['ADMINISTRADOR', 'ASESOR']` — no extra guard needed.
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/pages/order-list/admin-order-list.page').then(
            (m) => m.AdminOrderListPage,
          ),
        title: 'Pedidos — Administración — Ar Makers 3D',
      },
      {
        // Must be registered BEFORE 'orders/:id' so the literal segment does not get captured by
        // the ':id' param route. RF-11 ("Registro de pedidos", flujo personalizado) advisor
        // workflow — see `pages/register-personalized-order/`'s doc comment.
        path: 'orders/register-personalized',
        loadComponent: () =>
          import(
            './features/admin/pages/register-personalized-order/admin-register-personalized-order.page'
          ).then((m) => m.AdminRegisterPersonalizedOrderPage),
        title: 'Registrar pedido personalizado — Administración — Ar Makers 3D',
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./features/admin/pages/order-detail/admin-order-detail.page').then(
            (m) => m.AdminOrderDetailPage,
          ),
        title: 'Detalle del pedido — Administración — Ar Makers 3D',
      },
      {
        path: 'quotations',
        loadComponent: () =>
          import('./features/admin/pages/placeholder/admin-placeholder.page').then(
            (m) => m.AdminPlaceholderPage,
          ),
        data: {
          title: 'Cotizaciones',
          description:
            'Gestión de cotizaciones — Próximamente. Esta sección se implementará cuando el backend de cotizaciones (RF-10) esté disponible.',
        },
        title: 'Cotizaciones — Administración — Ar Makers 3D',
      },
      {
        // RF-16/RF-17/RF-18 ("Gestión de estados de incidencias"/"Clasificación de
        // prioridad"/"Registro de resolución") staff incident list — actor Administrador/Asesor,
        // see `pages/incident-list/admin-incident-list.page.ts`'s doc comment. Inherits the
        // parent's `['ADMINISTRADOR', 'ASESOR']` — no extra guard needed.
        path: 'incidents',
        loadComponent: () =>
          import('./features/admin/pages/incident-list/admin-incident-list.page').then(
            (m) => m.AdminIncidentListPage,
          ),
        title: 'Incidencias — Administración — Ar Makers 3D',
      },
      {
        path: 'incidents/:id',
        loadComponent: () =>
          import('./features/admin/pages/incident-detail/admin-incident-detail.page').then(
            (m) => m.AdminIncidentDetailPage,
          ),
        title: 'Detalle de la incidencia — Administración — Ar Makers 3D',
      },
      {
        // Administrador-ONLY — RF-19 (line 209: "Reportes... exclusivos para Administrador"). See
        // the parent route's doc comment above. Loads `AdminReportsPage` (client-side aggregation
        // over `AdminOrdersMockService`/`AdminIncidentsMockService` — `Reporte` is not a persisted
        // entity, see that page's doc comment), replacing the earlier generic placeholder.
        path: 'reports',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/admin/pages/reports/admin-reports.page').then(
            (m) => m.AdminReportsPage,
          ),
        data: {
          role: ADMIN_ONLY_ROLES,
        },
        title: 'Reportes — Administración — Ar Makers 3D',
      },
      {
        // RF-03 ("Autorización por rol / gestión de roles y permisos") admin user list —
        // Administrador-ONLY. See the parent route's doc comment above and
        // `pages/user-list/admin-user-list.page.ts`'s doc comment for the full requirement
        // grounding.
        path: 'users',
        canActivate: [authGuard],
        data: { role: ADMIN_ONLY_ROLES },
        loadComponent: () =>
          import('./features/admin/pages/user-list/admin-user-list.page').then(
            (m) => m.AdminUserListPage,
          ),
        title: 'Usuarios — Administración — Ar Makers 3D',
      },
      {
        // Administrador-ONLY, same as 'users' above.
        path: 'users/:id',
        canActivate: [authGuard],
        data: { role: ADMIN_ONLY_ROLES },
        loadComponent: () =>
          import('./features/admin/pages/user-detail/admin-user-detail.page').then(
            (m) => m.AdminUserDetailPage,
          ),
        title: 'Detalle del usuario — Administración — Ar Makers 3D',
      },
    ],
  },
  {
    // Public, unauthenticated static content pages (footer "Políticas"/"Información del
    // contacto" links) — see `features/legal/pages/*` doc comments for the Figma provenance and
    // the deliberate exclusion of the "Contactanos" form/FAQ CONFLICT pattern. No guard.
    path: 'legal/privacidad',
    loadComponent: () =>
      import('./features/legal/pages/privacy-policy/privacy-policy.page').then(
        (m) => m.PrivacyPolicyPage,
      ),
    title: 'Política de privacidad — Ar Makers 3D',
  },
  {
    path: 'legal/reembolso',
    loadComponent: () =>
      import('./features/legal/pages/refund-policy/refund-policy.page').then(
        (m) => m.RefundPolicyPage,
      ),
    title: 'Política de reembolso — Ar Makers 3D',
  },
  {
    path: 'legal/terminos',
    loadComponent: () =>
      import('./features/legal/pages/terms-of-service/terms-of-service.page').then(
        (m) => m.TermsOfServicePage,
      ),
    title: 'Términos de servicio — Ar Makers 3D',
  },
  {
    path: 'legal/envio',
    loadComponent: () =>
      import('./features/legal/pages/shipping-policy/shipping-policy.page').then(
        (m) => m.ShippingPolicyPage,
      ),
    title: 'Política de envío — Ar Makers 3D',
  },
  {
    path: 'legal/contacto',
    loadComponent: () =>
      import('./features/legal/pages/contact-info/contact-info.page').then(
        (m) => m.ContactInfoPage,
      ),
    title: 'Información del contacto — Ar Makers 3D',
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./shared/pages/forbidden.page').then((m) => m.ForbiddenPage),
    title: 'Acceso denegado — Ar Makers 3D',
  },
  {
    path: 'unexpected-error',
    loadComponent: () =>
      import('./shared/pages/unexpected-error.page').then((m) => m.UnexpectedErrorPage),
    title: 'Error — Ar Makers 3D',
  },
  {
    path: '**',
    loadComponent: () => import('./shared/pages/not-found.page').then((m) => m.NotFoundPage),
    title: 'Página no encontrada — Ar Makers 3D',
  },
];
