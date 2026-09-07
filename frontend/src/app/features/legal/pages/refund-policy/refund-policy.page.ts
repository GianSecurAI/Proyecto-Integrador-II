import { Component } from '@angular/core';
import { PolicySectionListComponent } from '../../components/policy-section-list/policy-section-list.component';
import { PolicySection } from '../../models/policy-section.model';

/**
 * Public, unauthenticated "Política de reembolso" page (footer link "Política de reembolso").
 * Structurally adapted from the Figma "Politica de Reembolso" frame (fileKey
 * `e1l878xWPLq1W1KVJ0wHrx`, node `3:2435`); copy is ORIGINAL for Ar Makers 3D, not the reference
 * frame's text — see `privacy-policy.page.ts`'s doc comment for the shared provenance rule.
 *
 * Content decisions specific to this project:
 * - Reflects that catalog/personalized items are made-to-order 3D prints, not off-the-shelf
 *   stock (`CLAUDE.md`) — change-of-mind returns on a completed custom print are not offered,
 *   but damaged/defective items are replaced or refunded, mirroring the reference frame's own
 *   "1-2 días hábiles" production framing at a similarly reasonable, non-fabricated timeframe.
 * - Explicitly distinguishes the two purchasing flows (`CLAUDE.md` "Business clarification:
 *   purchasing flows") since their refund path differs: catalog refunds route back through
 *   whichever payment gateway is eventually chosen; personalized-order refunds are handled
 *   directly by the advisor since that payment never touches the app's gateway.
 * - No payment gateway is named (not yet chosen).
 */
@Component({
  selector: 'app-refund-policy-page',
  standalone: true,
  imports: [PolicySectionListComponent],
  templateUrl: './refund-policy.page.html',
  styleUrls: ['../../legal-page.scss'],
})
export class RefundPolicyPage {
  readonly sections: PolicySection[] = [
    {
      heading: 'Nuestros productos son hechos a pedido',
      body: [
        'Todos los productos de Ar Makers 3D se imprimen bajo pedido, ya sea que elijas un producto de catálogo o solicites una pieza personalizada. Esto significa que la producción inicia recién después de confirmarse tu compra.',
      ],
    },
    {
      heading: 'Cuándo sí aplica un reembolso o reemplazo',
      body: ['Ofrecemos reemplazo o reembolso cuando el producto recibido:'],
      list: [
        'Llega dañado durante el envío.',
        'Presenta un defecto de impresión o fabricación.',
        'No corresponde al producto que confirmaste al comprar.',
      ],
    },
    {
      heading: 'Cuándo no aplica un reembolso',
      body: [
        'Al ser productos hechos a pedido, no se aceptan devoluciones por simple cambio de opinión una vez iniciada la producción, especialmente en el caso de piezas personalizadas coordinadas con un asesor.',
      ],
    },
    {
      heading: 'Cómo solicitar un reembolso o reemplazo',
      body: [
        'Para un producto de catálogo, inicia sesión y registra una incidencia desde tu cuenta indicando tu número de pedido y el motivo. Nuestro equipo revisará el caso y te contactará con la resolución.',
        'Para un pedido personalizado, comunícate directamente con tu asesor por WhatsApp, ya que ese pago se coordina fuera de la pasarela de pago de la tienda.',
      ],
    },
    {
      heading: 'Tiempos de respuesta',
      body: [
        'Buscamos revisar y responder toda solicitud de reembolso o reemplazo en un plazo razonable desde su registro. Los reembolsos de pedidos de catálogo se procesan a través del mismo medio de pago utilizado en la compra.',
      ],
    },
  ];
}
