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

  it('emits a partial patch when "Solo en oferta" is toggled', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));

    const checkbox: HTMLInputElement =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]')[0];
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{ onSaleOnly: true }]);
  });

  it('emits a partial patch when "Solo personalizable" is toggled', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));

    const checkbox: HTMLInputElement =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]')[1];
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{ personalizableOnly: true }]);
  });

  it('emits a category patch when a radio option is selected', () => {
    const emitted: Record<string, unknown>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => emitted.push(patch));

    const radios: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input[type="radio"]'),
    );
    const pegatinasRadio = radios.find((radio) => radio.value === 'pegatinas')!;
    pegatinasRadio.checked = true;
    pegatinasRadio.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{ category: 'pegatinas' }]);
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
