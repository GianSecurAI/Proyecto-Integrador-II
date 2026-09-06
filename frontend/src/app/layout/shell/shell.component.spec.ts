import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('renders the header, the routed-content region, and the footer together', () => {
    expect(fixture.nativeElement.querySelector('app-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#main-content')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-footer')).toBeTruthy();
  });

  it('does not render its own <main> element, since every routed page renders its own', () => {
    // HTML forbids two <main> landmarks; each routed page (auth pages, status pages) already
    // has one. The skip-link target here must be a plain container, not another <main>.
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
  });

  it('provides a skip link targeting the main content region', () => {
    const skipLink: HTMLAnchorElement = fixture.nativeElement.querySelector('.skip-link');
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });
});
