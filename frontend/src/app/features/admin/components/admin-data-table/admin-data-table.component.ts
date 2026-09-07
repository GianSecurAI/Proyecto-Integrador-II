import { Component } from '@angular/core';

/**
 * Generic, business-agnostic table wrapper for admin list screens (products, orders,
 * quotations, incidents, reports, users — see `docs/discovery/06-system-definition.md` lines
 * 197-201, 52-68). Deliberately content-projection-based (caller supplies its own `<thead>` /
 * `<tbody>`) rather than a `columns`/`rows` input API: every admin list will have a different,
 * business-specific column shape, and a generic `columns: Column[]` input would either need to
 * grow escape hatches for custom cell rendering (status badges, action buttons) or push
 * presentation decisions into this component — this way the wrapper owns only the shared visual
 * shell (border, scroll behavior) and never touches the domain data itself (Constitution
 * Prohibited Practice #5).
 *
 * The scroll container follows the general "wrap wide content in a horizontally-scrollable
 * region on narrow viewports" responsive convention used elsewhere in this repo (e.g.
 * `features/catalog/components/product-gallery/`) — no other table exists yet in this codebase
 * to reuse a scroll-wrapper pattern from, so this is the first one and other tables should reuse
 * this component rather than reinventing the scroll container.
 *
 * Composes cleanly with `shared/ui/empty-state`/`shared/ui/loading-state`: a future real data
 * screen renders one of those *instead of* this table while loading/empty, and this table once
 * data exists — this component itself fetches nothing and renders no such state on its own.
 */
@Component({
  selector: 'app-admin-data-table',
  standalone: true,
  templateUrl: './admin-data-table.component.html',
  styleUrl: './admin-data-table.component.scss',
})
export class AdminDataTableComponent {}
