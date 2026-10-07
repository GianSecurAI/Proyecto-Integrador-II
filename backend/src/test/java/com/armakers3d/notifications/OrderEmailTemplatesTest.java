package com.armakers3d.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.notifications.service.OrderEmailTemplates;
import com.armakers3d.orders.domain.OrderStatus;
import java.util.EnumSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class OrderEmailTemplatesTest {

    private static final String BASE = "https://app.armakers.example";

    @ParameterizedTest
    @EnumSource(value = OrderStatus.class, names = {"CONFIRMADO", "EN_PRODUCCION", "ENVIADO", "ENTREGADO", "CANCELADO"})
    void notifyingStatusesRenderSpanishMessageWithCodeStatusBusinessAndLink(OrderStatus status) {
        var r = OrderEmailTemplates.render(status, "PED-000042", "Ana Perez", BASE + "/").orElseThrow();

        assertThat(r.subject()).contains("Ar Makers 3D").contains("PED-000042");
        assertThat(r.body()).contains("Hola Ana Perez,").contains("Pedido: PED-000042").contains("Ar Makers 3D")
                .contains(BASE + "/track-order?orderId=PED-000042");
        assertThat(r.body()).doesNotContain("//track-order");
        assertThat(r.body()).doesNotContain(status.name());
    }

    @Test
    void friendlyWordsPerStatus() {
        assertThat(OrderEmailTemplates.render(OrderStatus.EN_PRODUCCION, "PED-1", null, BASE).orElseThrow().body())
                .contains("Estado: En preparacion").startsWith("Hola,");
        assertThat(OrderEmailTemplates.render(OrderStatus.ENVIADO, "PED-1", null, BASE).orElseThrow().body())
                .contains("Estado: Enviado");
    }

    @Test
    void cancelledEmailIsGenericAndMentionsWhatsAppButNoNote() {
        var r = OrderEmailTemplates.render(OrderStatus.CANCELADO, "PED-000042", "Ana", BASE).orElseThrow();
        assertThat(r.subject()).contains("PED-000042").contains("Cancelado");
        assertThat(r.body()).contains("cancelado").contains("WhatsApp").contains("Estado: Cancelado");
    }

    @Test
    void notifyingSetIsExactlyTheDocMap() {
        EnumSet<OrderStatus> notifying = EnumSet.noneOf(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) {
            if (OrderEmailTemplates.notifies(s)) {
                notifying.add(s);
            }
        }
        assertThat(notifying).containsExactlyInAnyOrder(
                OrderStatus.CONFIRMADO, OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO, OrderStatus.ENTREGADO,
                OrderStatus.CANCELADO);
    }

    @Test
    void hostileCustomerNameCannotInjectMarkupOrLines() {
        String hostile = "<script>alert(1)</script>\r\nBcc: evil@x.test\r\n\r\nInjected & \"quoted\"";
        var r = OrderEmailTemplates.render(OrderStatus.ENVIADO, "PED-000001", hostile, BASE).orElseThrow();

        assertThat(r.body()).doesNotContain("<").doesNotContain(">").doesNotContain("\r").doesNotContain("&")
                .doesNotContain("\"");
        assertThat(r.body().lines().findFirst().orElseThrow()).startsWith("Hola ").endsWith(",");
        assertThat(r.subject()).doesNotContain("\r").doesNotContain("\n").doesNotContain("evil");
    }

    @Test
    void overlongNameIsCapped() {
        var r = OrderEmailTemplates.render(OrderStatus.ENVIADO, "PED-000001", "a".repeat(500), BASE).orElseThrow();
        assertThat(r.body().lines().findFirst().orElseThrow().length()).isLessThan(80);
    }

    @Test
    void unsafeOrderCodeIsRejectedSoSubjectCannotBeInjected() {
        assertThatThrownBy(() -> OrderEmailTemplates.render(OrderStatus.ENVIADO, "PED-1\r\nBcc: x@y.z", "Ana", BASE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void baseUrlMustBeAbsoluteHttp() {
        assertThat(OrderEmailTemplates.requireValidBaseUrl("http://localhost:4200")).isEqualTo("http://localhost:4200");
        for (String bad : new String[] {"", "localhost:4200", "javascript:alert(1)", "ftp://x.test", "https://x.test/?a=b", null}) {
            assertThatThrownBy(() -> OrderEmailTemplates.requireValidBaseUrl(bad))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
