import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PolicySection } from '../../models/policy-section.model';
import { PolicySectionListComponent } from './policy-section-list.component';

const SAMPLE_SECTIONS: PolicySection[] = [
  {
    heading: 'Primera sección',
    body: ['Primer párrafo.', 'Segundo párrafo.'],
  },
  {
    heading: 'Segunda sección',
    body: ['Párrafo único.'],
    list: ['Elemento uno', 'Elemento dos'],
  },
];

describe('PolicySectionListComponent', () => {
  let fixture: ComponentFixture<PolicySectionListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PolicySectionListComponent] });
    fixture = TestBed.createComponent(PolicySectionListComponent);
    fixture.componentRef.setInput('sections', SAMPLE_SECTIONS);
    fixture.detectChanges();
  });

  it('renders one numbered h2 heading per section, in order', () => {
    const headings: HTMLHeadingElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('h2'),
    );
    expect(headings.length).toBe(2);
    expect(headings[0].textContent).toContain('1');
    expect(headings[0].textContent).toContain('Primera sección');
    expect(headings[1].textContent).toContain('2');
    expect(headings[1].textContent).toContain('Segunda sección');
  });

  it('renders every paragraph for each section', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Primer párrafo.');
    expect(text).toContain('Segundo párrafo.');
    expect(text).toContain('Párrafo único.');
  });

  it('renders a bullet list only for sections that supply one', () => {
    const lists: HTMLUListElement[] = Array.from(fixture.nativeElement.querySelectorAll('ul'));
    expect(lists.length).toBe(1);
    const items: HTMLLIElement[] = Array.from(lists[0].querySelectorAll('li'));
    expect(items.map((li) => li.textContent)).toEqual(['Elemento uno', 'Elemento dos']);
  });
});
