import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderStatus } from '../../../features/account/models/order.model';
import { OrderStatusTimelineComponent } from './order-status-timeline.component';

describe('OrderStatusTimelineComponent', () => {
  let fixture: ComponentFixture<OrderStatusTimelineComponent>;

  function create(status: OrderStatus): void {
    fixture = TestBed.createComponent(OrderStatusTimelineComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderStatusTimelineComponent],
    }).compileComponents();
  });

  it('renders all five happy-path steps with their Spanish labels', () => {
    create('pendiente');
    const steps: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.ui-order-timeline__step'),
    );
    expect(steps.length).toBe(5);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pendiente');
    expect(text).toContain('Confirmado');
    expect(text).toContain('En producción');
    expect(text).toContain('Enviado');
    expect(text).toContain('Entregado');
  });

  it('marks earlier steps as done and the matching current step as current (aria-current)', () => {
    create('en_produccion');
    const steps: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.ui-order-timeline__step'),
    );
    // pendiente, confirmado -> done; en_produccion -> current; enviado, entregado -> upcoming
    expect(steps[0].classList).toContain('ui-order-timeline__step--done');
    expect(steps[1].classList).toContain('ui-order-timeline__step--done');
    expect(steps[2].classList).toContain('ui-order-timeline__step--current');
    expect(steps[2].getAttribute('aria-current')).toBe('step');
    expect(steps[3].classList).not.toContain('ui-order-timeline__step--done');
    expect(steps[3].classList).not.toContain('ui-order-timeline__step--current');
    expect(steps[4].classList).not.toContain('ui-order-timeline__step--done');

    // only one step should ever be marked current
    const currentSteps = steps.filter((s) => s.getAttribute('aria-current') === 'step');
    expect(currentSteps.length).toBe(1);
  });

  it('gives a cancelled order a distinct visual treatment instead of a step position', () => {
    create('cancelado');
    const host: HTMLElement = fixture.nativeElement.querySelector('.ui-order-timeline');
    expect(host.classList).toContain('ui-order-timeline--cancelled');
    expect(fixture.nativeElement.textContent).toContain('cancelado');

    const steps: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.ui-order-timeline__step'),
    );
    expect(steps.some((s) => s.classList.contains('ui-order-timeline__step--done'))).toBeFalse();
    expect(
      steps.some((s) => s.classList.contains('ui-order-timeline__step--current')),
    ).toBeFalse();
    expect(steps.every((s) => s.getAttribute('aria-current') === null)).toBeTrue();
  });
});
