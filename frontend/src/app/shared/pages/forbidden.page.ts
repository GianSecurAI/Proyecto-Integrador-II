import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared "forbidden" destination the global interceptor (`error.interceptor.ts`) and the auth
 * guard redirect to on a backend-confirmed 403 (wrong role, or another customer's resource) —
 * reused by every feature per Constitution Principle IX, instead of each feature building its
 * own access-denied screen.
 */
@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="status-page">
      <h1>Acceso denegado</h1>
      <p>No tienes permiso para ver esta página.</p>
      <a routerLink="/">Volver al inicio</a>
    </main>
  `,
  styleUrl: './status-page.css',
})
export class ForbiddenPage {}
