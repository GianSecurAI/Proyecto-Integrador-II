import { Component, computed } from '@angular/core';
import { environment } from '../../../../../environments/environment';

/**
 * Public, unauthenticated "Información de contacto" page (footer link "Información del
 * contacto"). Maps to only ONE of the two structurally distinct parts of the Figma "Contactanos"
 * frame (fileKey `e1l878xWPLq1W1KVJ0wHrx`, node `3:3135`) — the right-column "INFORMACIÓN DEL
 * CONTACTO" panel (email, phone/hours, address, WhatsApp CTA).
 *
 * Deliberately NOT built from this page:
 * - The left-column generic contact FORM (nombre/apellido/correo/teléfono/asunto/mensaje +
 *   "Enviar mensaje"). `docs/discovery/05-figma-analysis.md` flags this exact pattern as a
 *   `CONFLICT`: a form with no real submission/persistence in place of the WhatsApp redirect
 *   `CLAUDE.md` requires for customer contact. Per Constitution Principle XV, a `CONFLICT`
 *   screen not since confirmed by the Product Owner must not be implemented as-is.
 * - The small "Preguntas frecuentes" (FAQ) box in the same frame — not one of the 5 requested
 *   footer links, and not backed by any approved spec item (Constitution Principle I).
 *
 * The WhatsApp CTA reuses the SAME `wa.me` link pattern already established at
 * `features/home/components/final-cta/final-cta.component.ts` (built from the placeholder
 * `environment.whatsappNumber`, never a hardcoded number) rather than inventing a second WhatsApp
 * integration approach.
 *
 * Email, phone/hours and address below are intentionally illustrative placeholder values (no
 * confirmed real contact channel exists yet) — a Lima-area address and a `+51` phone format, kept
 * obviously placeholder rather than styled to look like verified real-world data.
 */
@Component({
  selector: 'app-contact-info-page',
  standalone: true,
  templateUrl: './contact-info.page.html',
  styleUrls: ['../../legal-page.scss', './contact-info.page.scss'],
})
export class ContactInfoPage {
  readonly email = 'contacto@armakers3d.example';
  readonly phoneDisplay = '+51 900 000 000';
  readonly hours = 'Lunes a viernes, 9:00 a.m. – 6:00 p.m. (hora de Lima)';
  readonly address = 'Av. Larco 345, Miraflores, Lima, Perú';

  readonly whatsappHref = computed(() => {
    const message = 'Hola, quiero más información sobre Ar Makers 3D.';
    return `https://wa.me/${environment.whatsappNumber}?text=${encodeURIComponent(message)}`;
  });
}
