import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStateService } from '../../core/services/session-state.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let session: SessionStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderComponent);
    session = TestBed.inject(SessionStateService);
    fixture.detectChanges();
  });

  it('renders the brand wordmark', () => {
    expect(fixture.nativeElement.textContent).toContain('AR MAKERS');
  });

  it('links to the real catalog route', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/catalog"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Catálogo');
  });

  it('links to the real OTP login route when signed out, not an invented one', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href="/auth/request-code"]',
    );
    expect(link).toBeTruthy();
  });

  it('switches to the account link once SessionStateService reports authenticated', () => {
    session.markAuthenticated();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a[href="/account"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/auth/request-code"]')).toBeNull();
  });
});
