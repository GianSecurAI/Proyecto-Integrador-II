import { Component, input } from '@angular/core';

/**
 * Generic "nothing here yet" placeholder (e.g. an empty order-history list, an empty catalog
 * search result) reused across features instead of each one inventing its own copy/layout.
 * Any call-to-action is supplied by the feature via projection, since what that action does is
 * business logic this component must not know about (Constitution Prohibited Practice #5).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
