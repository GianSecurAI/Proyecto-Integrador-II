import { Component } from '@angular/core';
import { PolicySectionListComponent } from '../../components/policy-section-list/policy-section-list.component';
import { PolicySection } from '../../models/policy-section.model';

/**
 * Public, unauthenticated "Política de privacidad" page (footer link "Política de privacidad").
 * Structurally adapted from the Figma "Politicas de privacidad" frame (fileKey
 * `e1l878xWPLq1W1KVJ0wHrx`, node `3:2180`) — heading + subtitle + numbered card list — but the
 * copy below is ORIGINAL, written for Ar Makers 3D, not translated from the reference frame
 * (that frame's copy belongs to an unrelated template company; see `models/policy-section.model.ts`
 * and this repo's established "no reference copy verbatim" rule, e.g. `catalog-products.mock.ts`).
 *
 * Content decisions specific to this project (not present in the Figma reference):
 * - No password is ever described as collected/stored — authentication is OTP-only
 *   (`CLAUDE.md`, Constitution Principle VI); see the "Autenticación sin contraseña" section.
 * - No specific payment gateway is named — the provider is not yet chosen (`CLAUDE.md`).
 * - No specific Peruvian statute is cited — generic "leyes aplicables en Perú" framing only, to
 *   avoid presenting a fabricated legal citation this academic project cannot back.
 * - A closing notice states this is illustrative content for a university project, not a real,
 *   binding legal document — mirroring the "vista de demostración" honesty already used across
 *   this app's other mock/preview flows (e.g. `track-order.page.html`).
 */
@Component({
  selector: 'app-privacy-policy-page',
  standalone: true,
  imports: [PolicySectionListComponent],
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['../../legal-page.scss'],
})
export class PrivacyPolicyPage {
  readonly sections: PolicySection[] = [
    {
      heading: 'Información que recopilamos',
      body: [
        'Recopilamos únicamente la información necesaria para operar la tienda: tu correo electrónico (usado para enviarte el código temporal de acceso), tu nombre y datos de contacto para registrar tus pedidos, y el historial de pedidos e incidencias asociado a tu cuenta.',
        'También registramos información técnica básica (por ejemplo, eventos de inicio de sesión) con fines de seguridad, como la prevención de abuso sobre el envío de códigos de acceso.',
      ],
    },
    {
      heading: 'Autenticación sin contraseña',
      body: [
        'Ar Makers 3D no te pide crear ni recordar una contraseña. El acceso a tu cuenta se realiza mediante un código temporal (OTP) enviado a tu correo electrónico.',
        'Este código se maneja bajo las siguientes garantías de seguridad:',
      ],
      list: [
        'Expira después de un tiempo breve.',
        'Es de un solo uso: se invalida apenas se usa correctamente.',
        'Su envío está sujeto a límites de frecuencia (rate limiting).',
        'El número de intentos de verificación es limitado.',
        'Se almacena de forma segura, nunca en texto plano.',
      ],
    },
    {
      heading: 'Cómo usamos tu información',
      body: [
        'Usamos tus datos para: gestionar tu acceso mediante el código temporal, procesar y dar seguimiento a tus pedidos (estándar o personalizados), responder a tus consultas e incidencias, y proteger la plataforma frente a accesos indebidos.',
      ],
    },
    {
      heading: 'Con quién compartimos tu información',
      body: [
        'Compartimos información únicamente con los terceros estrictamente necesarios para operar el servicio, por ejemplo, la pasarela de pago que se determine para el checkout del catálogo (el proveedor específico aún no ha sido seleccionado).',
        'No vendemos ni compartimos tu información con fines publicitarios de terceros.',
      ],
    },
    {
      heading: 'Cómo protegemos tus datos',
      body: [
        'Aplicamos controles de acceso basados en roles (cliente, asesor, administrador), buenas prácticas de seguridad para el manejo de credenciales temporales, y registro de auditoría para las operaciones administrativas sensibles.',
      ],
    },
    {
      heading: 'Tus derechos',
      body: [
        'Puedes solicitar acceso, corrección o eliminación de tu información personal, sujeto a los periodos de conservación necesarios para el registro de pedidos e incidencias ya generados.',
      ],
    },
    {
      heading: 'Cambios a esta política',
      body: [
        'Esta política puede actualizarse conforme evolucione el servicio. Cualquier cambio relevante será publicado en esta misma página.',
      ],
    },
  ];
}
