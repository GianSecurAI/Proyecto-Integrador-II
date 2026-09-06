import { Component } from '@angular/core';
import { FinalCtaComponent } from '../../components/final-cta/final-cta.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { ProductShowcaseComponent } from '../../components/product-showcase/product-showcase.component';
import { WhyChooseUsComponent } from '../../components/why-choose-us/why-choose-us.component';
import { HOME_LATEST_PRODUCTS, HOME_TRENDING_PRODUCTS } from '../../mocks/home-products.mock';

/**
 * Home page: POSSIBLE_EXTENSION per docs/discovery/05-figma-analysis.md §1 ("a landing page
 * isn't an explicit requirement, but a reasonable extension of RF-07/08"), confirmed by direct
 * Product Owner instruction in this session (no `RF-xx` exists yet for this screen — the
 * Product Owner's direct decision is itself the Principle-I-required confirmation, per the
 * Constitution's governance section on decision authority). Extends RF-07/RF-08 catalog
 * discovery with a landing page that surfaces mock product data until a real catalog endpoint
 * exists.
 *
 * Composes the five Home sections; owns no business logic, no HTTP calls, and no mock data of
 * its own (each section pulls its own typed mock from `../../mocks/`).
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [HeroComponent, ProductShowcaseComponent, WhyChooseUsComponent, FinalCtaComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  readonly trendingProducts = HOME_TRENDING_PRODUCTS;
  readonly latestProducts = HOME_LATEST_PRODUCTS;
}
