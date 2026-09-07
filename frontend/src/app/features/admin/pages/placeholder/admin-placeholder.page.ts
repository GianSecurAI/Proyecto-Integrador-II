import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

/**
 * Generic, reusable "not built yet" screen for five of the six approved admin domains (orders,
 * quotations, incidents, reports, users — see `admin-sidebar.component.ts`'s doc comment for the
 * requirement IDs). Title/description come from the route's `data` (see `app.routes.ts`'s
 * `admin` children) — the same "parametrize via route metadata" approach this app already uses
 * for the `title` route property (document title), just extended to the visible page body too.
 *
 * Deliberately does not fetch anything, render a fake table, or invent a "coming soon" widget
 * beyond a title + description — this is chrome/routing scaffolding, not a feature
 * implementation, per this task's explicit scope.
 */
@Component({
  selector: 'app-admin-placeholder-page',
  standalone: true,
  imports: [AdminPageHeaderComponent, EmptyStateComponent],
  templateUrl: './admin-placeholder.page.html',
})
export class AdminPlaceholderPage {
  private readonly route = inject(ActivatedRoute);

  private readonly data = this.route.snapshot.data as { title?: string; description?: string };

  readonly title = this.data.title ?? 'Sección de administración';
  readonly description = this.data.description ?? null;
}
