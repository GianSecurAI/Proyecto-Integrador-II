import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDataTableComponent } from './admin-data-table.component';

@Component({
  standalone: true,
  imports: [AdminDataTableComponent],
  template: `
    <app-admin-data-table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Llavero</td>
        </tr>
      </tbody>
    </app-admin-data-table>
  `,
})
class HostComponent {}

describe('AdminDataTableComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders a projected thead with column headers', () => {
    expect(fixture.nativeElement.querySelector('thead th')?.textContent).toContain('ID');
  });

  it('renders a projected tbody with rows', () => {
    const cells: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody td'));
    const cellText = cells.map((cell) => cell.textContent);
    expect(cellText).toContain('Llavero');
  });

  it('wraps the table in a horizontally-scrollable container', () => {
    const scroll = fixture.nativeElement.querySelector('.admin-data-table__scroll');
    expect(scroll).toBeTruthy();
    expect(scroll.querySelector('table.admin-data-table')).toBeTruthy();
  });
});
