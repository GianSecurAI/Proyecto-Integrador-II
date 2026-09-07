import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPageHeaderComponent } from './admin-page-header.component';

@Component({
  standalone: true,
  imports: [AdminPageHeaderComponent],
  template: `
    <app-admin-page-header title="Productos" description="Gestión del catálogo">
      <button adminPageHeaderActions type="button">Nuevo producto</button>
    </app-admin-page-header>
  `,
})
class HostComponent {}

describe('AdminPageHeaderComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the title', () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('.admin-page-header__title');
    expect(title.textContent).toContain('Productos');
  });

  it('renders the optional description', () => {
    const description: HTMLElement = fixture.nativeElement.querySelector(
      '.admin-page-header__description',
    );
    expect(description.textContent).toContain('Gestión del catálogo');
  });

  it('projects actions content', () => {
    expect(fixture.nativeElement.textContent).toContain('Nuevo producto');
  });
});
