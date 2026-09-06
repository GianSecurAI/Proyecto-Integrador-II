import { Component, input } from '@angular/core';

/**
 * Generic in-progress placeholder for any async region — one shared pattern reused across
 * features instead of each screen inventing its own spinner (Constitution Principle IX).
 * Purely visual; carries no business data.
 */
@Component({
  selector: 'app-loading-state',
  standalone: true,
  templateUrl: './loading-state.component.html',
  styleUrl: './loading-state.component.scss',
})
export class LoadingStateComponent {
  readonly message = input('Cargando…');
}
