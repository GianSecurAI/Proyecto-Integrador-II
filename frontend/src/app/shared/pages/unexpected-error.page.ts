import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared fallback for unexpected/network failures (HTTP status 0 or 5xx) surfaced by the
 * global `error.interceptor.ts` (Constitution Principle IX) — deliberately generic wording,
 * since a technical error response must never leak stack traces or internal detail to the
 * client (Principle IX).
 */
@Component({
  selector: 'app-unexpected-error-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="status-page">
      <h1>Ocurrió un error inesperado</h1>
      <p>Algo salió mal de nuestro lado. Inténtalo de nuevo en unos minutos.</p>
      <a routerLink="/">Volver al inicio</a>
    </main>
  `,
  styleUrl: './status-page.css',
})
export class UnexpectedErrorPage {}
