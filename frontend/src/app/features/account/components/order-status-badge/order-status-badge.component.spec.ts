import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderStatusBadgeComponent } from './order-status-badge.component';

describe('OrderStatusBadgeComponent', () => {
  let fixture: ComponentFixture<OrderStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(OrderStatusBadgeComponent);
  });

  it('maps "entregado" to its Spanish label and success tone', () => {
    fixture.componentRef.setInput('status', 'entregado');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Entregado');
    expect(badge.className).toContain('ui-status-badge--success');
  });

  it('maps "cancelado" to its Spanish label and danger tone', () => {
    fixture.componentRef.setInput('status', 'cancelado');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Cancelado');
    expect(badge.className).toContain('ui-status-badge--danger');
  });

  it('maps "pendiente" to its Spanish label and neutral tone', () => {
    fixture.componentRef.setInput('status', 'pendiente');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Pendiente');
    expect(badge.className).toContain('ui-status-badge--neutral');
  });
});
