import { Component, input, output } from '@angular/core';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  CatalogCategory,
} from '../../models/catalog-filters.model';

/**
 * Catalog page heading + quick category-pill row (Figma node 2:7) and a catalog-scoped product
 * search box.
 *
 * The heading reuses the "plain word + lime accent word" split-heading pattern already
 * established by `product-showcase.component.html` on the Home page, rather than reinventing it.
 *
 * The category pills are one of two controls bound to the same `category` state (the other is
 * the sidebar's radio list in `CatalogFiltersComponent`) — this component owns no filtering
 * logic itself, it only reports the selected category upward via `categoryChange` so
 * `CatalogPage` can keep both controls and the actual product filtering in sync from one place
 * (see `utils/filter-catalog-products.ts`).
 *
 * The search input is intentionally catalog-scoped, not added to the shared `HeaderComponent`:
 * Figma's only search box lives in the global header, but that header was deliberately left
 * without one because no catalog existed yet to search (see header.component.ts doc-comment).
 * Now that `/catalog` exists, the honest reading of that Figma element is a page-scoped search
 * for this specific feature, not new cross-route chrome.
 */
@Component({
  selector: 'app-catalog-toolbar',
  standalone: true,
  imports: [FormFieldComponent],
  templateUrl: './catalog-toolbar.component.html',
  styleUrl: './catalog-toolbar.component.scss',
})
export class CatalogToolbarComponent {
  readonly category = input.required<CatalogCategory>();
  readonly query = input.required<string>();

  readonly categoryChange = output<CatalogCategory>();
  readonly queryChange = output<string>();

  readonly categories = CATALOG_CATEGORIES;
  readonly categoryLabels = CATALOG_CATEGORY_LABELS;

  selectCategory(category: CatalogCategory): void {
    this.categoryChange.emit(category);
  }

  onQueryInput(value: string): void {
    this.queryChange.emit(value);
  }
}
