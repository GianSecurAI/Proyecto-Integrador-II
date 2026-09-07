import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared "page not found" route (Constitution Principle IX) — a wildcard destination reused by
 * every feature, not reinvented per route tree.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="status-page">
      <h1>Página no encontrada</h1>
      <p>La página que buscas no existe o fue movida.</p>
      <a routerLink="/" class="ui-btn ui-btn--primary ui-btn--md">Volver al inicio</a>
    </main>
  `,
  styleUrl: './status-page.css',
})
export class NotFoundPage {}
