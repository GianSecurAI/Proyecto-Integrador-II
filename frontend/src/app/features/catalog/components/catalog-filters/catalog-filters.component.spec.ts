import { ComponentFixture, TestBed } from '@angular/core/testing';
import { defaultCatalogFilters } from '../../models/catalog-filters.model';
import { CatalogFiltersComponent } from './catalog-filters.component';

describe('CatalogFiltersComponent', () => {
  let fixture: ComponentFixture<CatalogFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogFiltersComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogFiltersComponent);
    fixture.componentRef.setInput('filters', defaultCatalogFilters());
    fixture.detectChanges();
  });

  it('no longer offers the Figma-only on-sale / personalizable options (no backend support)', () => {
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('emits a sort patch using a backend sort token', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'price,asc';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{ sort: 'price,asc' }]);
  });

  it('emits a category patch when a radio option is selected', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));

    const radios: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    );
    const pegatinasRadio = radios.find((radio) => radio.value === 'PEGATINAS')!;
    pegatinasRadio.checked = true;
    pegatinasRadio.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{ category: 'PEGATINAS' }]);
  });

  it('parses min/max price inputs to numbers, and empty strings to null', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));

    const [minInput, maxInput]: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="number"]'),
    );

    minInput.value = '10';
    minInput.dispatchEvent(new Event('input'));
    maxInput.value = '';
    maxInput.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([{ minPrice: 10 }, { maxPrice: null }]);
  });

  it('emits reset when "Restablecer filtros" is clicked', () => {
    let resetCount = 0;
    fixture.componentInstance.resetFilters.subscribe(() => resetCount++);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();

    expect(resetCount).toBe(1);
  });
});
