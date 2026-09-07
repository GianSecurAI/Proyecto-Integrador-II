import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminSidebarComponent } from './admin-sidebar.component';

@Component({ standalone: true, template: '' })
class StubPage {}

describe('AdminSidebarComponent', () => {
  let fixture: ComponentFixture<AdminSidebarComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSidebarComponent],
      providers: [provideRouter([{ path: 'admin/products', component: StubPage }])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminSidebarComponent);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders all six approved admin domain links', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-sidebar__link'),
    );
    const hrefTargets = links.map((link) => link.getAttribute('routerLink') ?? link.pathname);
    expect(links.length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Productos');
    expect(fixture.nativeElement.textContent).toContain('Pedidos');
    expect(fixture.nativeElement.textContent).toContain('Cotizaciones');
    expect(fixture.nativeElement.textContent).toContain('Incidencias');
    expect(fixture.nativeElement.textContent).toContain('Reportes');
    expect(fixture.nativeElement.textContent).toContain('Usuarios y roles');
  });

  it('points each link at its /admin/<domain> route', () => {
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.admin-sidebar__link'),
    );
    const paths = links.map((link) => link.pathname);
    expect(paths).toEqual([
      '/admin/products',
      '/admin/orders',
      '/admin/quotations',
      '/admin/incidents',
      '/admin/reports',
      '/admin/users',
    ]);
  });

  it('marks the current route with aria-current="page"', async () => {
    await router.navigateByUrl('/admin/products');
    fixture.detectChanges();

    const activeLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.admin-sidebar__link--active',
    );
    expect(activeLink).toBeTruthy();
    expect(activeLink.getAttribute('aria-current')).toBe('page');
  });

  it('toggles the open modifier class from the `open` input', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.admin-sidebar--open')).toBeTruthy();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.admin-sidebar--open')).toBeNull();
  });
});
