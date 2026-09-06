import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'Sin resultados');
    fixture.detectChanges();
  });

  it('renders the required title', () => {
    expect(fixture.nativeElement.textContent).toContain('Sin resultados');
  });

  it('omits the description paragraph when none is provided', () => {
    expect(fixture.nativeElement.querySelector('.ui-state__message')).toBeNull();
  });
});
