import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { AdminTopbarComponent } from './admin-topbar.component';

describe('AdminTopbarComponent', () => {
  let fixture: ComponentFixture<AdminTopbarComponent>;
  let session: SessionStateService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTopbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminTopbarComponent);
    session = TestBed.inject(SessionStateService);
    router = TestBed.inject(Router);
  });

  it('renders the admin section label', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Panel de administración');
  });

  it('renders the real signed-in ADMINISTRADOR role and email, not a static placeholder', () => {
    session.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Administrador');
    expect(fixture.nativeElement.textContent).toContain('admin.principal@armakers3d.com');
  });

  it('renders the real signed-in ASESOR role and email', () => {
    session.markAuthenticated('ASESOR', 'asesor.andrea@armakers3d.com');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Asesor');
    expect(fixture.nativeElement.textContent).toContain('asesor.andrea@armakers3d.com');
  });

  it('emits toggleSidebar when the toggle button is clicked', () => {
    fixture.detectChanges();
    const emitted = jasmine.createSpy('toggleSidebar');
    fixture.componentInstance.toggleSidebar.subscribe(emitted);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.admin-topbar__toggle');
    button.click();

    expect(emitted).toHaveBeenCalled();
  });

  it('reflects the sidebarOpen input as aria-expanded on the toggle button', () => {
    fixture.componentRef.setInput('sidebarOpen', true);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.admin-topbar__toggle');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('clears the session and navigates home when the logout control is clicked', () => {
    session.markAuthenticated('ADMINISTRADOR', 'admin.principal@armakers3d.com');
    fixture.detectChanges();
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.admin-topbar__logout');
    expect(button).toBeTruthy();
    button.click();

    expect(session.isAuthenticated()).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
