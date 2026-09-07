import { Component, input } from '@angular/core';

/**
 * Reusable "screen heading" for every admin page: a title, an optional short description, and
 * an optional projected actions slot (e.g. a future "Nuevo producto" button — this task only
 * wires the slot, no action). Scoped under `features/admin/components/` rather than
 * `shared/ui/` because every current caller is an admin screen and there is no confirmed need
 * outside `/admin` yet — the same "keep it feature-scoped until proven cross-cutting" judgment
 * call already made for `features/account/components/order-status-badge/` vs the generic
 * `shared/ui/status-badge/`.
 */
@Component({
  selector: 'app-admin-page-header',
  standalone: true,
  templateUrl: './admin-page-header.component.html',
  styleUrl: './admin-page-header.component.scss',
})
export class AdminPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
