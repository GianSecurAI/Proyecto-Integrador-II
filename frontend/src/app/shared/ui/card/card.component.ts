import { Component, input } from '@angular/core';

export type CardPadding = 'sm' | 'md' | 'lg';

/**
 * Generic content container using the neobrutalist card treatment from
 * docs/discovery/05-figma-analysis.md §11 (hard shadow, 1px border) — stripped of every
 * business-specific piece of that pattern (product image, price, stock badge). Feature areas
 * compose their own content via projection; this component owns only the visual shell.
 */
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  readonly padding = input<CardPadding>('md');
}
