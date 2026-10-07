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
    fixture.componentRef.setInput('status', 'ENTREGADO');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Entregado');
    expect(badge.className).toContain('ui-status-badge--success');
  });

  it('maps "cancelado" to its Spanish label and danger tone', () => {
    fixture.componentRef.setInput('status', 'CANCELADO');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Cancelado');
    expect(badge.className).toContain('ui-status-badge--danger');
  });

  it('maps "confirmado" to its Spanish label and info tone', () => {
    fixture.componentRef.setInput('status', 'CONFIRMADO');
    fixture.detectChanges();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.ui-status-badge');
    expect(badge.textContent?.trim()).toBe('Confirmado');
    expect(badge.className).toContain('ui-status-badge--info');
  });
});
