import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminTopbarComponent } from './admin-topbar.component';

describe('AdminTopbarComponent', () => {
  let fixture: ComponentFixture<AdminTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTopbarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminTopbarComponent);
    fixture.detectChanges();
  });

  it('renders the admin section label and the static administrator placeholder', () => {
    expect(fixture.nativeElement.textContent).toContain('Panel de administración');
    expect(fixture.nativeElement.textContent).toContain('Administrador');
  });

  it('emits toggleSidebar when the toggle button is clicked', () => {
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
});
