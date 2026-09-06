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
    path: 'account',
    loadComponent: () =>
      import('./features/auth/pages/account/account.page').then((m) => m.AccountPage),
    canActivate: [authGuard],
    data: { role: 'CLIENTE' },
    title: 'Tu cuenta — Ar Makers 3D',
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
