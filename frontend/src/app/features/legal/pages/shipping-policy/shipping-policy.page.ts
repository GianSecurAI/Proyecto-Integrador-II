import { Component } from '@angular/core';
import { PolicySectionListComponent } from '../../components/policy-section-list/policy-section-list.component';
import { PolicySection } from '../../models/policy-section.model';

/**
 * Public, unauthenticated "Política de envío" page (footer link "Política de envío").
 * Structurally adapted from the Figma "Politicas de envio" frame (fileKey
 * `e1l878xWPLq1W1KVJ0wHrx`, node `3:2905`); copy is ORIGINAL for Ar Makers 3D — see
 * `privacy-policy.page.ts`'s doc comment for the shared provenance rule.
 *
 * Content decisions specific to this project:
 * - Production timeframe reflects that these are made-to-order 3D prints, using a similarly
 *   reasonable "1-2 días hábiles" figure the reference frame itself suggests for production
 *   (not a fabricated number).
 * - Points to the real, already-built public `/track-order` page rather than inventing a new
 *   tracking mechanism.
 * - Personalized orders are shipped/coordinated separately via the advisor/WhatsApp flow, kept
 *   distinct from the catalog flow per `CLAUDE.md`.
 */
@Component({
  selector: 'app-shipping-policy-page',
  standalone: true,
  imports: [PolicySectionListComponent],
  templateUrl: './shipping-policy.page.html',
  styleUrls: ['../../legal-page.scss'],
})
export class ShippingPolicyPage {
  readonly sections: PolicySection[] = [
    {
      heading: 'Cobertura de envío',
      body: [
        'Actualmente despachamos pedidos de catálogo dentro de Perú, coordinando el envío a través de un servicio de courier según la dirección que registres al finalizar tu compra.',
      ],
    },
    {
      heading: 'Tiempo de producción',
      body: [
        'Como cada producto se imprime bajo pedido, la producción suele tomar entre 1 y 2 días hábiles antes de despacharse, dependiendo de la complejidad de la pieza.',
      ],
    },
    {
      heading: 'Tiempo de entrega estimado',
      body: [
        'Una vez despachado, el tiempo de entrega varía según tu ubicación: generalmente de 1 a 3 días hábiles dentro de Lima, y de 3 a 7 días hábiles para otras ciudades del país.',
      ],
    },
    {
      heading: 'Costos de envío',
      body: [
        'El costo de envío se calcula durante el checkout, junto con el resto del pago, a través de la pasarela de pago que se determine para la tienda.',
      ],
    },
    {
      heading: 'Seguimiento de tu pedido',
      body: [
        'Puedes consultar el estado de tu pedido en cualquier momento desde tu cuenta o desde nuestra página pública de seguimiento de pedidos, ingresando el ID de tu pedido.',
      ],
    },
    {
      heading: 'Pedidos personalizados',
      body: [
        'Los tiempos de producción y envío de pedidos personalizados se coordinan directamente con tu asesor por WhatsApp, ya que pueden variar según la pieza solicitada.',
      ],
    },
    {
      heading: 'Problemas con la entrega',
      body: [
        'Si tu pedido no llega dentro del tiempo estimado o llega en mal estado, regístralo como una incidencia desde tu cuenta para que nuestro equipo lo revise.',
      ],
    },
  ];
}
