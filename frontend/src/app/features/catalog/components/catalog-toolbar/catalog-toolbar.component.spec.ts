import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogToolbarComponent } from './catalog-toolbar.component';

describe('CatalogToolbarComponent', () => {
  let fixture: ComponentFixture<CatalogToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogToolbarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogToolbarComponent);
    fixture.componentRef.setInput('category', 'todo');
    fixture.componentRef.setInput('query', '');
    fixture.detectChanges();
  });

  it('renders the split heading "Todos los productos" with the accent on "productos"', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading.textContent).toContain('Todos los');
    const accent = heading.querySelector('.catalog-toolbar__heading-accent');
    expect(accent.textContent.trim()).toBe('productos');
  });

  it('renders one pill per category and marks the active one', () => {
    const pills: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.catalog-toolbar__pill'),
    );
    expect(pills.length).toBe(4);
    const active = pills.find((pill) => pill.classList.contains('catalog-toolbar__pill--active'));
    expect(active?.textContent).toContain('Todo');
    expect(active?.getAttribute('aria-pressed')).toBe('true');
  });

  it('emits categoryChange when a pill is clicked', () => {
    const emitted: string[] = [];
    fixture.componentInstance.categoryChange.subscribe((category) => emitted.push(category));

    const pills: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.catalog-toolbar__pill'),
    );
    const llaveroPill = pills.find((pill) => pill.textContent?.includes('Llavero'));
    llaveroPill?.click();

    expect(emitted).toEqual(['llavero']);
  });

  it('emits queryChange as the user types in the search box', () => {
    const emitted: string[] = [];
    fixture.componentInstance.queryChange.subscribe((query) => emitted.push(query));

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = 'llavero';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['llavero']);
  });

  it('labels the search input accessibly', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(label.getAttribute('for')).toBe(input.id);
  });
});
