package com.armakers3d.notifications.service;

import java.util.regex.Pattern;

/**
 * Plain-text Spanish template for the "payment proof rejected" email (ADR-005). Pure and stateless. Content: a
 * generic message, the administrator's reason (control characters, angle brackets, ampersands and quotes neutralized,
 * length capped), and the link to the checkout page. No amount, no payment data, no ids other than the checkout id
 * the customer already owns. The approval email is the existing CONFIRMADO order email.
 */
public final class PaymentEmailTemplates {

    static final int REASON_MAX = 300;
    private static final Pattern UUID_FORMAT =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private PaymentEmailTemplates() {}

    public static OrderEmailTemplates.Rendered proofRejected(
            String customerName, String reason, String checkoutId, String frontendBaseUrl) {
        if (checkoutId == null || !UUID_FORMAT.matcher(checkoutId).matches()) {
            throw new IllegalArgumentException("Unsafe checkout id");
        }
        String name = OrderEmailTemplates.sanitize(customerName);
        String greeting = name.isEmpty() ? "Hola," : "Hola " + name + ",";
        String cleanReason = OrderEmailTemplates.sanitize(reason, REASON_MAX);
        String base = frontendBaseUrl.endsWith("/") ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1) : frontendBaseUrl;
        String link = base + "/checkout/confirmacion?checkoutId=" + checkoutId;
        String subject = OrderEmailTemplates.BUSINESS_NAME + ": no pudimos validar tu comprobante de pago";
        String body = greeting + "\n\n"
                + "Revisamos el comprobante de pago que subiste y no pudimos validarlo.\n\n"
                + (cleanReason.isEmpty() ? "" : "Motivo: " + cleanReason + "\n\n")
                + "Puedes subir un nuevo comprobante o cancelar tu compra aqui: " + link + "\n\n"
                + "Equipo " + OrderEmailTemplates.BUSINESS_NAME + "\n";
        return new OrderEmailTemplates.Rendered(subject, body);
    }
}
