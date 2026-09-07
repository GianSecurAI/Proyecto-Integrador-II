import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminShellComponent } from './admin-shell.component';

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
  });

  it('renders the topbar, sidebar, and a single <main> content region', () => {
    expect(fixture.nativeElement.querySelector('app-admin-topbar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-admin-sidebar')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('main').length).toBe(1);
  });

  it('starts with the sidebar closed (off-canvas default on narrow viewports)', () => {
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
  });

  it('toggles the sidebar open state when the topbar requests it', () => {
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.admin-topbar__toggle');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.admin-sidebar--open')).toBeTruthy();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.admin-sidebar--open')).toBeNull();
  });
});
