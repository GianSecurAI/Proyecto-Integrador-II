import { Component } from '@angular/core';

interface WhyChooseUsFeature {
  iconBg: 'accent' | 'info' | 'success';
  icon: 'bolt' | 'shield' | 'star' | 'chat';
  title: string;
  description: string;
}

/**
 * "Why choose us" section (Figma node 1:358). ADAPTED per orchestrator instruction:
 * - Brand name substituted: "¿Por qué elegir NUHO?" -> "¿Por qué elegir Ar Makers 3D?".
 * - 4th card's content replaced entirely: Figma's "Envío gratis" copy describes an unconfirmed
 *   shipping policy priced in the wrong currency (₹300). Replaced with "Asesoría personalizada",
 *   which matches the actual confirmed business process (project requirements: an advisor communicates with
 *   the customer over WhatsApp for every custom order).
 *
 * Icons are hand-authored inline SVGs (simple geometric paths), not Figma icon assets — generic
 * pictograms only, `aria-hidden="true"`, purely decorative; the visible title/description text
 * carries the actual meaning.
 */
@Component({
  selector: 'app-why-choose-us',
  standalone: true,
  templateUrl: './why-choose-us.component.html',
  styleUrl: './why-choose-us.component.scss',
})
export class WhyChooseUsComponent {
  readonly features: WhyChooseUsFeature[] = [
    {
      iconBg: 'accent',
      icon: 'bolt',
      title: 'Procesamiento rápido',
      description: 'Plazos de entrega rápidos sin comprometer la calidad.',
    },
    {
      iconBg: 'info',
      icon: 'shield',
      title: 'Calidad premium',
      description: 'Materiales de alta calidad y tecnología de impresión de precisión.',
    },
    {
      iconBg: 'accent',
      icon: 'star',
      title: 'Diseños personalizados',
      description: 'Productos personalizados adaptados a tu visión única.',
    },
    {
      iconBg: 'success',
      icon: 'chat',
      title: 'Asesoría personalizada',
      description: 'Un asesor te acompaña por WhatsApp en cada pedido personalizado.',
    },
  ];
}
