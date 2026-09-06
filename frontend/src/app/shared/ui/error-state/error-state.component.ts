import { Component, input } from '@angular/core';

/**
 * Generic recoverable-error placeholder for an async region that failed to load — distinct
 * from the routed unexpected-error page (shared/pages/unexpected-error.page.ts), which handles
 * navigation-level failures (Constitution Principle IX). The retry action is supplied by the
 * feature via projection; this component never decides on its own whether a retry is safe.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  readonly title = input('Ocurrió un error');
  readonly description = input<string | null>(null);
}
