import { Routes } from '@angular/router';

/**
 * The two OTP screens only — no password/login route, no self-service registration form, per
 * Constitution Principle VI (NON-NEGOTIABLE).
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'request-code',
    loadComponent: () =>
      import('./pages/request-code/request-code.page').then((m) => m.RequestCodePage),
    title: 'Ingresar con correo — Ar Makers 3D',
  },
  {
    path: 'verify-code',
    loadComponent: () =>
      import('./pages/verify-code/verify-code.page').then((m) => m.VerifyCodePage),
    title: 'Verificar código — Ar Makers 3D',
  },
];
