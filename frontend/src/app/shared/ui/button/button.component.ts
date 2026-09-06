import { Component, computed, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Generic, business-agnostic action button for the shared design system
 * (docs/architecture/frontend-foundation.md). Visual language adapted from the repeated
 * Button pattern in docs/discovery/05-figma-analysis.md §9 (hard shadow, 1px border,
 * uppercase bold label). It never decides on its own whether an action is allowed
 * (Constitution Prohibited Practice #5) — callers control `disabled`/`loading`.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);
  /** Set when the button sits on a dark surface (e.g. inside the header). */
  readonly onDark = input(false);

  readonly clicked = output<MouseEvent>();

  readonly classes = computed(() =>
    [
      'ui-btn',
      `ui-btn--${this.variant()}`,
      `ui-btn--${this.size()}`,
      this.fullWidth() ? 'ui-btn--full' : '',
      this.onDark() ? 'ui-btn--on-dark' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  handleClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    this.clicked.emit(event);
  }
}
