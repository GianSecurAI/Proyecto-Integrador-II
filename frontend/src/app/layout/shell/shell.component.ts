import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';

/**
 * Application shell: header + routed content + footer, composed once here so `layout/`
 * stays the single place that owns page chrome (project requirements frontend conventions), rather than
 * `App` doing it directly. Includes a skip-link because every route now has a header before
 * its main content (Constitution Principle XVI).
 *
 * The public `<app-header>`/`<app-footer>` (storefront brand, Catálogo/Mi cuenta nav, policy
 * links) are hidden under `/admin/**`: `features/admin/` supplies its own dedicated chrome
 * (`AdminShellComponent` — topbar + sidebar scoped to the six approved admin domains), and
 * wrapping that area in the customer-facing marketing chrome would be visually and semantically
 * wrong (it is a separate, role-gated area — see `app.routes.ts`'s `/admin` guard). `isAdminArea`
 * is a reactive signal (not a one-time snapshot) derived from `Router` events so navigating
 * between a public route and `/admin/**` in the same session (e.g. via browser back/forward)
 * correctly toggles the chrome without a full reload.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);

  readonly isAdminArea = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/admin')),
      startWith(this.router.url.startsWith('/admin')),
    ),
    { initialValue: this.router.url.startsWith('/admin') },
  );
}
