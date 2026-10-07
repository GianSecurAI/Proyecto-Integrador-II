import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogService } from '../../../catalog/services/catalog.service';
import { CatalogProduct } from '../../../../shared/models/catalog-product.model';
import { FinalCtaComponent } from '../../components/final-cta/final-cta.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { ProductShowcaseComponent } from '../../components/product-showcase/product-showcase.component';
import { WhyChooseUsComponent } from '../../components/why-choose-us/why-choose-us.component';

/**
 * Home page: POSSIBLE_EXTENSION per docs/discovery/05-figma-analysis.md §1 (landing page
 * confirmed by direct Product Owner instruction). Composes the Home sections; owns no business
 * logic. The "Últimos productos" showcase is real data (`GET /api/catalog/products?sort=
 * createdAt,desc&size=4`); if the request fails or the catalog is empty the section is simply
 * omitted so the landing page still renders. The Figma "Tendencias actuales" section was dropped:
 * there is no "most sold"/trending concept or data in the backend, and inventing one is out of
 * scope. The hero's trust-band numbers remain MOCK (`mocks/home-stats.mock.ts`) — no backend
 * aggregate exists.
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [HeroComponent, ProductShowcaseComponent, WhyChooseUsComponent, FinalCtaComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly catalog = inject(CatalogService);

  readonly latestProducts = signal<CatalogProduct[]>([]);

  constructor() {
    this.catalog
      .latest(4)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (page) => this.latestProducts.set(page.content),
        error: () => this.latestProducts.set([]),
      });
  }
}
