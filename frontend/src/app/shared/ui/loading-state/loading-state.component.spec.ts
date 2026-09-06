import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingStateComponent } from './loading-state.component';

describe('LoadingStateComponent', () => {
  let fixture: ComponentFixture<LoadingStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoadingStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(LoadingStateComponent);
  });

  it('announces itself to assistive tech via role=status', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows a custom message when provided', () => {
    fixture.componentRef.setInput('message', 'Buscando pedidos…');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Buscando pedidos…');
  });
});
