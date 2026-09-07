import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  CatalogCategory,
  CatalogFilters,
} from '../../models/catalog-filters.model';

/**
 * Sidebar filter panel (Figma node 2:27): "FILTROS" heading, "OPCIONES" checkboxes, "CATEGORÍAS"
 * radio list, "GAMA DE PRECIOS" min/max inputs, and a "Restablecer filtros" button. Filtering is
 * reactive/local against the already-loaded product list — the real Figma file has no "aplicar"
 * button for this panel, so every control change reports upward immediately via
 * `filtersChange`, rather than this component (or `CatalogPage`) inventing an apply step.
 *
 * The category radio list is one of two controls bound to the same `category` state (the other
 * is the toolbar's quick pill row in `CatalogToolbarComponent`) — selecting either updates the
 * same `CatalogFilters.category`, kept in sync by `CatalogPage` owning the one signal both read
 * from and write to.
 *
 * ADAPTATION: Figma's category radio uses an arbitrary UI-kit blue (#0075ff) for the checked
 * state. That color is unrelated to this project's palette, so the native radio here uses
 * `.ui-radio` (see `_forms.scss`), which is accent-colored with `--ar-color-accent` — the same
 * lime used for the toolbar's own active-pill state, so the two category controls (and every
 * other selection/active state in the app) are visually consistent with each other.
 */
@Component({
  selector: 'app-catalog-filters',
  standalone: true,
  imports: [FormFieldComponent, ButtonComponent],
  templateUrl: './catalog-filters.component.html',
  styleUrl: './catalog-filters.component.scss',
})
export class CatalogFiltersComponent {
  readonly filters = input.required<CatalogFilters>();

  readonly filtersChange = output<Partial<CatalogFilters>>();
  readonly resetFilters = output<void>();

  readonly categories = CATALOG_CATEGORIES;
  readonly categoryLabels = CATALOG_CATEGORY_LABELS;

  toggleOnSaleOnly(checked: boolean): void {
    this.filtersChange.emit({ onSaleOnly: checked });
  }

  togglePersonalizableOnly(checked: boolean): void {
    this.filtersChange.emit({ personalizableOnly: checked });
  }

  selectCategory(category: CatalogCategory): void {
    this.filtersChange.emit({ category });
  }

  updateMinPrice(value: string): void {
    this.filtersChange.emit({ minPrice: parsePrice(value) });
  }

  updateMaxPrice(value: string): void {
    this.filtersChange.emit({ maxPrice: parsePrice(value) });
  }

  onReset(): void {
    this.resetFilters.emit();
  }
}

function parsePrice(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
