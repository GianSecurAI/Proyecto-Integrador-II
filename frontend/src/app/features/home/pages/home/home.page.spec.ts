import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HOME_LATEST_PRODUCTS, HOME_TRENDING_PRODUCTS } from '../../mocks/home-products.mock';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  it('composes hero, both showcases, why-choose-us, and the final CTA', () => {
    const el = fixture.nativeElement;
    expect(el.querySelector('app-hero')).toBeTruthy();
    expect(el.querySelectorAll('app-product-showcase').length).toBe(2);
    expect(el.querySelector('app-why-choose-us')).toBeTruthy();
    expect(el.querySelector('app-final-cta')).toBeTruthy();
  });

  it('provides exactly one <main> landmark (the shell renders none of its own, see shell.component.spec.ts)', () => {
    expect(fixture.nativeElement.querySelectorAll('main').length).toBe(1);
  });

  it('feeds each showcase its own mock product list', () => {
    expect(fixture.componentInstance.trendingProducts).toBe(HOME_TRENDING_PRODUCTS);
    expect(fixture.componentInstance.latestProducts).toBe(HOME_LATEST_PRODUCTS);
  });
});
