import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  let fixture: ComponentFixture<ErrorStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ErrorStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.detectChanges();
  });

  it('exposes role=alert so assistive tech announces the failure', () => {
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('uses a sensible default title when none is provided', () => {
    expect(fixture.nativeElement.textContent).toContain('Ocurrió un error');
  });
});
