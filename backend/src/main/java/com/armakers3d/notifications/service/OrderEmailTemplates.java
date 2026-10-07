package com.armakers3d.notifications.service;

import com.armakers3d.orders.domain.OrderStatus;
import java.net.URI;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Plain-text Spanish templates for order status emails (order-lifecycle.md section 4). Pure and
 * stateless: no I/O. Plain text only, so no markup is interpreted by the mail client; dynamic values are
 * nevertheless sanitized (control characters, angle brackets, ampersands and quotes removed, length
 * capped) so a hostile profile name can neither inject headers nor smuggle markup. Content is limited to
 * the order code, the new status in friendly words, a short message and the tracking link: no ids, no
 * prices, no payment data, no other customers' data.
 */
public final class OrderEmailTemplates {

    public static final String BUSINESS_NAME = "Ar Makers 3D";

    private static final Pattern SAFE_CODE = Pattern.compile("[A-Za-z0-9-]{1,20}");
    private static final int NAME_MAX = 60;

    public record Rendered(String subject, String body) {}

    private OrderEmailTemplates() {}

    /** Which statuses send an email: exactly the lifecycle doc map (CONFIRMADO, EN_PRODUCCION, ENVIADO, ENTREGADO). */
    public static boolean notifies(OrderStatus status) {
        return status == OrderStatus.CONFIRMADO || status == OrderStatus.EN_PRODUCCION
                || status == OrderStatus.ENVIADO || status == OrderStatus.ENTREGADO;
    }

    /** Empty when the status does not notify. */
    public static Optional<Rendered> render(OrderStatus status, String orderCode, String customerName, String frontendBaseUrl) {
        if (!notifies(status)) {
            return Optional.empty();
        }
        if (orderCode == null || !SAFE_CODE.matcher(orderCode).matches()) {
            throw new IllegalArgumentException("Unsafe order code");
        }
        String friendly;
        String message;
        switch (status) {
            case CONFIRMADO -> {
                friendly = "Confirmado";
                message = "Hemos confirmado tu pedido y pronto comenzaremos con su preparacion.";
            }
            case EN_PRODUCCION -> {
                friendly = "En preparacion";
                message = "Tu pedido ya esta en preparacion.";
            }
            case ENVIADO -> {
                friendly = "Enviado";
                message = "Tu pedido ya fue enviado y va en camino.";
            }
            default -> {
                friendly = "Entregado";
                message = "Tu pedido fue entregado. Gracias por confiar en nosotros.";
            }
        }
        String name = sanitize(customerName);
        String greeting = name.isEmpty() ? "Hola," : "Hola " + name + ",";
        String link = trackingLink(frontendBaseUrl, orderCode);
        String subject = BUSINESS_NAME + ": tu pedido " + orderCode + " - " + friendly;
        String body = greeting + "\n\n"
                + message + "\n\n"
                + "Pedido: " + orderCode + "\n"
                + "Estado: " + friendly + "\n\n"
                + "Puedes seguir tu pedido aqui: " + link + "\n\n"
                + "Equipo " + BUSINESS_NAME + "\n";
        return Optional.of(new Rendered(subject, body));
    }

    static String trackingLink(String baseUrl, String orderCode) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return base + "/track-order?orderId=" + orderCode;
    }

    /** Validates the configured base URL once at startup: absolute http(s), no query/fragment. */
    public static String requireValidBaseUrl(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value.trim());
            boolean ok = uri.isAbsolute() && ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawQuery() == null && uri.getRawFragment() == null;
            if (ok) {
                return value.trim();
            }
        } catch (IllegalArgumentException ignored) {
            // fall through to the generic error below (the value itself is not echoed)
        }
        throw new IllegalStateException("app.frontend-base-url must be an absolute http(s) URL");
    }

    static String sanitize(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (char c : raw.toCharArray()) {
            if (Character.isISOControl(c) || c == '<' || c == '>' || c == '&' || c == '"' || c == '\'') {
                sb.append(' ');
            } else {
                sb.append(c);
            }
        }
        String clean = sb.toString().trim().replaceAll("\\s+", " ");
        return clean.length() > NAME_MAX ? clean.substring(0, NAME_MAX).trim() : clean;
    }
}
