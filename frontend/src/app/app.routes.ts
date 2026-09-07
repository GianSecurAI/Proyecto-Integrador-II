import { Routes } from '@angular/router';
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
    data: { role: 'CLIENTE' },
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
    // Admin panel shell (features/admin/) — visual foundation/layout only, no admin business
    // screens implemented yet. Guarded exactly like `/account` above, but with `role:
    // 'ADMINISTRADOR'` — no admin authentication flow exists yet, so this route is deliberately
    // unreachable in the running preview (no fake "admin session" bypass is introduced; see
    // `SessionStateService`/`authGuard`). `loadComponent` here supplies the admin-only chrome
    // (topbar + sidebar) that replaces the public header/footer under this path (see
    // `layout/shell/shell.component.ts`'s `isAdminArea` signal).
    path: 'admin',
    canActivate: [authGuard],
    data: { role: 'ADMINISTRADOR' },
    loadComponent: () =>
      import('./features/admin/layout/admin-shell/admin-shell.component').then(
        (m) => m.AdminShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'products' },
      {
        // The one domain (RF-07/HU06 "Gestionar catálogo de productos") with a real feature
        // implementation — list/detail/create — instead of the generic placeholder used by the
        // other five domains below. See `pages/product-list/admin-product-list.page.ts`'s doc
        // comment for the full requirement grounding.
        path: 'products',
        loadComponent: () =>
          import('./features/admin/pages/product-list/admin-product-list.page').then(
            (m) => m.AdminProductListPage,
          ),
        title: 'Productos — Administración — Ar Makers 3D',
      },
      {
        // Must be registered BEFORE 'products/:id' so the literal segment 'new' does not get
        // captured by the ':id' param route.
        path: 'products/new',
        loadComponent: () =>
          import('./features/admin/pages/product-create/admin-product-create.page').then(
            (m) => m.AdminProductCreatePage,
          ),
        title: 'Nuevo producto — Administración — Ar Makers 3D',
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./features/admin/pages/product-detail/admin-product-detail.page').then(
            (m) => m.AdminProductDetailPage,
          ),
        title: 'Detalle del producto — Administración — Ar Makers 3D',
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/pages/placeholder/admin-placeholder.page').then(
            (m) => m.AdminPlaceholderPage,
          ),
        data: {
          title: 'Pedidos',
          description:
            'Gestión de pedidos — Próximamente. Esta sección se implementará cuando el backend de pedidos (RF-13) esté disponible.',
        },
        title: 'Pedidos — Administración — Ar Makers 3D',
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
        path: 'incidents',
        loadComponent: () =>
          import('./features/admin/pages/placeholder/admin-placeholder.page').then(
            (m) => m.AdminPlaceholderPage,
          ),
        data: {
          title: 'Incidencias',
          description:
            'Gestión de incidencias — Próximamente. Esta sección se implementará cuando el backend de incidencias (RF-16/17/18) esté disponible.',
        },
        title: 'Incidencias — Administración — Ar Makers 3D',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/pages/placeholder/admin-placeholder.page').then(
            (m) => m.AdminPlaceholderPage,
          ),
        data: {
          title: 'Reportes',
          description:
            'Generación de reportes — Próximamente. Esta sección se implementará cuando el backend de reportes (RF-19) esté disponible.',
        },
        title: 'Reportes — Administración — Ar Makers 3D',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/pages/placeholder/admin-placeholder.page').then(
            (m) => m.AdminPlaceholderPage,
          ),
        data: {
          title: 'Usuarios y roles',
          description:
            'Gestión de usuarios y roles — Próximamente. Esta sección se implementará cuando el backend de autorización por rol (RF-03) esté disponible.',
        },
        title: 'Usuarios y roles — Administración — Ar Makers 3D',
      },
    ],
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
