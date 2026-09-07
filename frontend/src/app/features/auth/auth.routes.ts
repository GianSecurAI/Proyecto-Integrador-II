import { Routes } from '@angular/router';

/**
 * OTP-only auth screens: request code, an optional pre-OTP "create account" step (email plus
 * optional profile fields, per specs/001-customer-otp-auth/spec.md Assumptions Amendment
 * 2026-09-07), and verify code. No password field or OAuth/social login route exists anywhere
 * here, per Constitution Principle VI (NON-NEGOTIABLE) — that constraint governs the absence of
 * password auth, not the number of routes in this file.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'request-code',
    loadComponent: () =>
      import('./pages/request-code/request-code.page').then((m) => m.RequestCodePage),
    title: 'Ingresar con correo — Ar Makers 3D',
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
    title: 'Crear cuenta — Ar Makers 3D',
  },
  {
    path: 'verify-code',
    loadComponent: () =>
      import('./pages/verify-code/verify-code.page').then((m) => m.VerifyCodePage),
    title: 'Verificar código — Ar Makers 3D',
  },
];
