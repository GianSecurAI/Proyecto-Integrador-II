import { Component } from '@angular/core';
import { PolicySectionListComponent } from '../../components/policy-section-list/policy-section-list.component';
import { PolicySection } from '../../models/policy-section.model';

/**
 * Public, unauthenticated "Términos de servicio" page (footer link "Términos de servicio").
 * Structurally adapted from the Figma "Terminos de servicio" frame (fileKey
 * `e1l878xWPLq1W1KVJ0wHrx`, node `3:2676`); copy is ORIGINAL for Ar Makers 3D — see
 * `privacy-policy.page.ts`'s doc comment for the shared provenance rule.
 *
 * Content decisions specific to this project:
 * - Describes BOTH purchasing flows exactly as `CLAUDE.md`'s "Business clarification" defines
 *   them, without blending them onto one section — self-service catalog checkout vs.
 *   advisor-mediated, WhatsApp-redirected personalized orders.
 * - "Cuentas y autenticación" describes OTP-only access, never a password.
 * - "Legislación aplicable" uses generic "leyes aplicables en Perú" language — no specific
 *   numbered statute or RUC is cited, to avoid a fabricated-looking legal citation.
 * - Prices are described in soles (PEN) with the payment gateway left unnamed (not yet chosen).
 */
@Component({
  selector: 'app-terms-of-service-page',
  standalone: true,
  imports: [PolicySectionListComponent],
  templateUrl: './terms-of-service.page.html',
  styleUrls: ['../../legal-page.scss'],
})
export class TermsOfServicePage {
  readonly sections: PolicySection[] = [
    {
      heading: 'Aceptación de los términos',
      body: [
        'Al usar la tienda de Ar Makers 3D aceptas estos términos de servicio. Si no estás de acuerdo con alguno de ellos, te pedimos no usar la plataforma.',
      ],
    },
    {
      heading: 'Descripción del servicio',
      body: [
        'Ar Makers 3D ofrece dos formas de compra distintas: productos de catálogo mediante compra directa (carrito y pago en línea), y piezas personalizadas coordinadas manualmente con un asesor a través de WhatsApp.',
      ],
    },
    {
      heading: 'Cuentas y autenticación',
      body: [
        'El acceso a tu cuenta se realiza mediante un código temporal enviado a tu correo electrónico (OTP); no se usan contraseñas. Cada rol (cliente, asesor, administrador) tiene permisos distintos dentro de la plataforma.',
      ],
    },
    {
      heading: 'Compras en el catálogo',
      body: [
        'Para productos de catálogo, seleccionas el producto y la cantidad, lo agregas al carrito y completas el pago a través de la pasarela de pago integrada. El pedido se genera automáticamente al confirmarse el pago, sin intervención manual de un asesor.',
      ],
    },
    {
      heading: 'Pedidos personalizados',
      body: [
        'Para una pieza personalizada, serás redirigido a WhatsApp para conversar con un asesor, quien te enviará una cotización manual. El pago de este flujo se realiza fuera de la pasarela de pago de la tienda; una vez confirmado, el asesor registra el pedido en la plataforma y podrás hacerle seguimiento como cualquier otro pedido.',
      ],
    },
    {
      heading: 'Precios y pagos',
      body: [
        'Los precios se muestran en soles (PEN). El proveedor de la pasarela de pago para el checkout del catálogo aún no ha sido definido; se indicará en la plataforma una vez confirmado.',
      ],
    },
    {
      heading: 'Incidencias y seguimiento',
      body: [
        'Puedes hacer seguimiento del estado de tus pedidos desde tu cuenta o desde la página pública de seguimiento, y registrar una incidencia si algo no está correcto.',
      ],
    },
    {
      heading: 'Legislación aplicable',
      body: [
        'Estos términos se rigen por las leyes aplicables en Perú, país donde opera Ar Makers 3D.',
      ],
    },
    {
      heading: 'Modificaciones a estos términos',
      body: [
        'Podemos actualizar estos términos conforme el servicio evolucione. Los cambios relevantes se publicarán en esta misma página.',
      ],
    },
  ];
}
