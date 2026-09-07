import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileFieldRowComponent } from './profile-field-row.component';

@Component({
  standalone: true,
  imports: [ProfileFieldRowComponent],
  template: `<app-profile-field-row label="Correo electrónico" value="maria@example.com" />`,
})
class HostComponent {}

describe('ProfileFieldRowComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders both the label and the value', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Correo electrónico');
    expect(text).toContain('maria@example.com');
  });
});
