import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';

/**
 * Reusable "heading + product grid + CTA" section, used twice on the Home page (Figma nodes
 * 1:46 "Tendencias actuales" and 1:159 "Últimos productos" — same structural pattern, different
 * copy/data, so it's implemented once and configured via inputs rather than duplicated).
 *
 * The bottom CTA now routes to the real `/catalog` page (Figma-equivalent "Ver todos los
 * productos") instead of being rendered disabled — that placeholder was only correct while no
 * catalog route existed (see docs/architecture/frontend-foundation.md §9 for the prior state).
 */
@Component({
  selector: 'app-product-showcase',
  standalone: true,
  imports: [ProductCardComponent, RouterLink],
  templateUrl: './product-showcase.component.html',
  styleUrl: './product-showcase.component.scss',
})
export class ProductShowcaseComponent {
  /** First word of the heading, rendered in plain white. */
  readonly heading = input.required<string>();
  /** Second word of the heading, rendered in the lime accent color. */
  readonly headingAccent = input.required<string>();
  readonly subheading = input.required<string>();
  readonly products = input.required<CatalogProduct[]>();
  readonly ctaLabel = input.required<string>();
}
