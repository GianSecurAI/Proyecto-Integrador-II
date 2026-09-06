import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Global footer, present on every route. Visual language adapted from
 * docs/discovery/05-figma-analysis.md §9 (white surface, black text, hard shadow). The
 * original Figma footer's payment-method badges (UPI/Visa/Mastercard/rupee), social icons, and
 * Trustpilot badge are excluded outright: an integrated payment gateway is an explicit project
 * exclusion (project requirements), and social handles / third-party review integrations are not
 * confirmed requirements (Constitution Principle I, Prohibited Practice #7).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
