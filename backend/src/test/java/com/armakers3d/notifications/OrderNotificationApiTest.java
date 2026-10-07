package com.armakers3d.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.shared.notification.EmailSender;
import com.armakers3d.shared.notification.SmtpEmailSender;
import com.armakers3d.testsupport.CapturingEmailSender.SentEmail;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.armakers3d.users.domain.CustomerProfile;
import com.armakers3d.users.repository.CustomerProfileRepository;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Stage 11 end to end through HTTP (nodb, capturing sender): the status endpoint triggers the customer email. */
class OrderNotificationApiTest extends AbstractNoDbRbacTest {

    @Autowired private OrderRepository orders;
    @Autowired private CustomerProfileRepository profiles;
    @Autowired private ApplicationContext context;

    private Order orderOf(Long customerId) {
        return orders.save(Order.placeStandard(
                orders.nextOrderNumber(), customerId,
                List.of(new OrderLine(1L, "Llavero", new BigDecimal("12.50"), 2)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), clock.instant()));
    }

    private ResultActions change(Cookie cookie, String orderId, String newStatus) throws Exception {
        return mockMvc.perform(patch("/api/admin/orders/" + orderId + "/status")
                .cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", newStatus))));
    }

    private Cookie staff(Rol rol) throws Exception {
        String email = uniqueEmail(rol.name().toLowerCase());
        provision(email, rol);
        Cookie c = signIn(email);
        emailSender.clear(); // drop the OTP mail
        return c;
    }

    @Test
    void statusChangeEmailsTheOrdersCustomerOnlyAndNotStaff() throws Exception {
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Cookie advisor = staff(Rol.ASESOR);
        Order o = orderOf(idOf(customer));

        change(advisor, o.id(), "EN_PRODUCCION").andExpect(status().isOk());

        assertThat(emailSender.getSent()).hasSize(1);
        SentEmail mail = emailSender.getSent().get(0);
        assertThat(mail.to()).isEqualTo(customer);
        assertThat(mail.subject()).contains(o.id());
        assertThat(mail.body()).contains(o.id()).contains("http://localhost:4200/track-order?orderId=" + o.id())
                .contains("Ar Makers 3D");
        assertThat(mail.body()).doesNotContain("Llavero").doesNotContain("12.50").doesNotContain("25.00")
                .doesNotContain("CONFIRMADO").doesNotContain("customerId").doesNotContain("Calle 1");
    }

    @Test
    void everyTransitionSendsAndTheCancelEmailNeverContainsTheHistoryNote() throws Exception {
        Cookie advisor = staff(Rol.ASESOR);
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Order o = orderOf(idOf(customer));

        change(advisor, o.id(), "EN_PRODUCCION").andExpect(status().isOk());
        change(advisor, o.id(), "ENVIADO").andExpect(status().isOk());
        change(advisor, o.id(), "ENTREGADO").andExpect(status().isOk());
        assertThat(emailSender.getSent()).hasSize(3);
        assertThat(emailSender.getSent()).extracting(SentEmail::to).containsOnly(customer);

        emailSender.clear();
        Order c = orderOf(idOf(customer));
        mockMvc.perform(patch("/api/admin/orders/" + c.id() + "/status").cookie(advisor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "CANCELADO", "note", "reembolso-interno-12345"))))
                .andExpect(status().isOk());
        assertThat(emailSender.getSent()).hasSize(1);
        SentEmail cancelMail = emailSender.getSent().get(0);
        assertThat(cancelMail.to()).isEqualTo(customer);
        assertThat(cancelMail.subject()).contains(c.id()).contains("Cancelado");
        assertThat(cancelMail.body()).contains("cancelado").contains("WhatsApp");
        assertThat(cancelMail.body()).doesNotContain("reembolso-interno-12345");
    }

    @Test
    void rejectedTransitionSendsNothing() throws Exception {
        Cookie advisor = staff(Rol.ASESOR);
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Order o = orderOf(idOf(customer));

        change(advisor, o.id(), "ENTREGADO").andExpect(status().isConflict());

        assertThat(emailSender.getSent()).isEmpty();
    }

    @Test
    void senderFailureDoesNotFailOrRollBackTheStatusChange() throws Exception {
        Cookie advisor = staff(Rol.ASESOR);
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Order o = orderOf(idOf(customer));
        emailSender.setFailing(true);

        change(advisor, o.id(), "EN_PRODUCCION").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EN_PRODUCCION"));

        assertThat(orders.findById(o.id()).orElseThrow().status()).isEqualTo(OrderStatus.EN_PRODUCCION);
        assertThat(emailSender.getSent()).isEmpty();
    }

    @Test
    void personalizedOrderRegistrationEmailsTheRegisteredCustomer() throws Exception {
        Cookie advisor = staff(Rol.ASESOR);
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customerEmail", customer);
        body.put("description", "Figura articulada personalizada 15 cm");
        body.put("agreedAmount", new BigDecimal("150.50"));
        body.put("paymentConfirmed", true);

        mockMvc.perform(post("/api/admin/orders/personalized").cookie(advisor)
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isCreated());

        assertThat(emailSender.getSent()).hasSize(1);
        assertThat(emailSender.getSent().get(0).to()).isEqualTo(customer);
        assertThat(emailSender.getSent().get(0).body()).doesNotContain("150.50").doesNotContain("Figura");
    }

    @Test
    void hostileProfileNameAndForgedBodyEmailCannotRedirectOrInjectIntoTheMessage() throws Exception {
        String customer = uniqueEmail("cust");
        provision(customer, Rol.CLIENTE);
        Long id = idOf(customer);
        profiles.save(new CustomerProfile(id, "<script>alert(1)</script>\r\nBcc: evil@x.test", "Perez", null));
        Cookie advisor = staff(Rol.ASESOR);
        Order o = orderOf(id);

        mockMvc.perform(patch("/api/admin/orders/" + o.id() + "/status").cookie(advisor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "EN_PRODUCCION", "to", "evil@x.test", "email", "evil@x.test"))))
                .andExpect(status().isOk());

        assertThat(emailSender.getSent()).hasSize(1);
        SentEmail mail = emailSender.getSent().get(0);
        assertThat(mail.to()).isEqualTo(customer);
        assertThat(mail.body()).doesNotContain("<script").doesNotContain("\r");
        assertThat(mail.subject()).doesNotContain("\n");
    }

    @Test
    void underNodbTestConfigNoRealSmtpSenderExists() {
        assertThat(context.getBeansOfType(SmtpEmailSender.class)).isEmpty();
        assertThat(context.getBean(EmailSender.class)).isSameAs(emailSender);
    }
}
