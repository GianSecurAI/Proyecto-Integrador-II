import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HOME_STATS } from '../../mocks/home-stats.mock';

/**
 * Hero banner (Figma node 1:7). ADAPT per orchestrator instruction: the 5-line literal heading
 * ("PRODUCTOS" / "PERSONALIZADOS" / "Y" / "REGALOS" / "PERSONALIZADOS") is collapsed into one
 * real `<h1>` with natural line breaks, keeping only "Y" in the lime accent color — not five
 * hardcoded `<p>` tags.
 *
 * The primary CTA now routes to the real `/catalog` page. It previously scroll-linked to
 * `#destacados` as a stand-in while no catalog route existed (see
 * docs/architecture/frontend-foundation.md §9); that anchor plumbing is gone now that a real
 * destination exists. It's a plain `.ui-btn` anchor with `routerLink` rather than `app-button`
 * (which only renders a `<button>`) — same convention as the header's "Acceder" link, since this
 * genuinely navigates.
 */
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  readonly stats = HOME_STATS;
}
