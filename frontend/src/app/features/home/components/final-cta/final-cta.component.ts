import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';

/**
 * Closing CTA banner (Figma node 1:422). ADAPTED per orchestrator instruction: the brand mention
 * ("NUHO") is removed from the subheading entirely, not substituted for "Ar Makers 3D" — the
 * heading itself already carries the brand-appropriate accent word.
 *
 * "Comience a comprar" now routes to the real `/catalog` page (it previously reused the hero's
 * anchor-scroll-to-`#destacados` pattern while no catalog route existed). "Conecta por WhatsApp"
 * is a real `wa.me` deep link — this one IS a confirmed business flow (project requirements: customers are
 * redirected to WhatsApp for personalized orders) — built from the placeholder
 * `environment.whatsappNumber`, not a hardcoded number.
 */
@Component({
  selector: 'app-final-cta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './final-cta.component.html',
  styleUrl: './final-cta.component.scss',
})
export class FinalCtaComponent {
  readonly whatsappHref = computed(() => {
    const message = 'Hola, quiero más información sobre productos personalizados de Ar Makers 3D.';
    return `https://wa.me/${environment.whatsappNumber}?text=${encodeURIComponent(message)}`;
  });
}
