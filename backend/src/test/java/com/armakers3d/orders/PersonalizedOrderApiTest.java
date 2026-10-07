package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderKind;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * POST /api/admin/orders/personalized over HTTP (MockMvc, nodb, full security chain): role access,
 * customer eligibility (D-13), validation, forged fields, idempotency, no payment data.
 */
class PersonalizedOrderApiTest extends AbstractNoDbRbacTest {

    private static final String PATH = "/api/admin/orders/personalized";

    @Autowired private OrderRepository orderRepository;

    private static Map<String, Object> body(String email) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("customerEmail", email);
        m.put("description", "Figura articulada personalizada 15 cm, resina gris");
        m.put("agreedAmount", new BigDecimal("150.50"));
        m.put("paymentConfirmed", true);
        return m;
    }

    private ResultActions register(Cookie cookie, String key, Object body) throws Exception {
        var req = post(PATH).contentType(MediaType.APPLICATION_JSON).content(json(body));
        if (cookie != null) {
            req.cookie(cookie);
        }
        if (key != null) {
            req.header("Idempotency-Key", key);
        }
        return mockMvc.perform(req);
    }

    private JsonNode read(ResultActions a) throws Exception {
        return objectMapper.readTree(a.andReturn().getResponse().getContentAsString());
    }

    // ---------- authorization ----------

    @Test
    void advisorRegistersAnOrderForAnExistingCustomer() throws Exception {
        String customerEmail = uniqueEmail("cust");
        provision(customerEmail, Rol.CLIENTE);
        String advisorEmail = uniqueEmail("asesor");
        provision(advisorEmail, Rol.ASESOR);
        Cookie advisor = signIn(advisorEmail);

        JsonNode json = read(register(advisor, null, body(customerEmail))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/admin/orders/PED-")))
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.matchesPattern("PED-\\d{6}")))
                .andExpect(jsonPath("$.kind").value("PERSONALIZADO"))
                .andExpect(jsonPath("$.status").value("CONFIRMADO"))
                .andExpect(jsonPath("$.customerEmail").value(customerEmail))
                .andExpect(jsonPath("$.registeredBy").value(advisorEmail))
                .andExpect(jsonPath("$.payment").doesNotExist())
                .andExpect(jsonPath("$.paymentConfirmed").doesNotExist()));
        assertThat(json.get("agreedAmount").decimalValue()).isEqualByComparingTo("150.50");
        assertThat(json.get("totalAmount").decimalValue()).isEqualByComparingTo("150.50");

        Order stored = orderRepository.findById(json.get("id").asText()).orElseThrow();
        assertThat(stored.kind()).isEqualTo(OrderKind.PERSONALIZADO);
        assertThat(stored.status()).isEqualTo(OrderStatus.CONFIRMADO);
        assertThat(stored.customerId()).isEqualTo(idOf(customerEmail));
        assertThat(stored.registeredBy()).isEqualTo(idOf(advisorEmail));
    }

    @Test
    void administratorMayAlsoRegister() throws Exception {
        String customerEmail = uniqueEmail("cust");
        provision(customerEmail, Rol.CLIENTE);
        register(signInAs(Rol.ADMINISTRADOR), null, body(customerEmail))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("PERSONALIZADO"));
    }

    @Test
    void customerCannotRegisterAnOrder() throws Exception {
        String email = uniqueEmail("cust");
        Cookie customer = signIn(email);
        long before = orderRepository.findByCustomerId(idOf(email)).size();
        register(customer, null, body(email)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize((int) before);
    }

    @Test
    void anonymousGets401() throws Exception {
        register(null, null, body(uniqueEmail("cust")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---------- customer resolution (D-13) ----------

    @Test
    void unknownEmailCreatesAnActiveCustomerAccountAndOrderBelongsToIt() throws Exception {
        String email = uniqueEmail("newcust").toUpperCase();
        Cookie advisor = signInAs(Rol.ASESOR);
        JsonNode json = read(register(advisor, null, body("  " + email + " ")).andExpect(status().isCreated()));

        Cliente created = clienteRepository.findByEmail(email.toLowerCase()).orElseThrow();
        assertThat(created.getRol()).isEqualTo(Rol.CLIENTE);
        assertThat(created.isActive()).isTrue();
        assertThat(orderRepository.findById(json.get("id").asText()).orElseThrow().customerId()).isEqualTo(created.getId());
        assertThat(json.get("customerEmail").asText()).isEqualTo(email.toLowerCase());
    }

    @Test
    void inactiveCustomerIsRejectedAndNoOrderIsCreated() throws Exception {
        String email = uniqueEmail("off");
        Cliente c = provision(email, Rol.CLIENTE);
        clienteRepository.save(c.withActive(false));
        register(signInAs(Rol.ASESOR), null, body(email))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_ELIGIBLE"));
        assertThat(orderRepository.findByCustomerId(c.getId())).isEmpty();
    }

    @Test
    void staffAccountCannotBeTheCustomer() throws Exception {
        String email = uniqueEmail("otheradvisor");
        Cliente staff = provision(email, Rol.ASESOR);
        register(signInAs(Rol.ADMINISTRADOR), null, body(email))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_ELIGIBLE"));
        assertThat(orderRepository.findByCustomerId(staff.getId())).isEmpty();
    }

    // ---------- validation ----------

    @Test
    void invalidDataIsRejectedWithFieldErrorsAndCreatesNothingNorAnAccount() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        String email = uniqueEmail("val");
        record Case(String field, Object value) {}
        Case[] cases = {
            new Case("agreedAmount", new BigDecimal("0")),
            new Case("agreedAmount", new BigDecimal("-5.00")),
            new Case("agreedAmount", new BigDecimal("10.001")),
            new Case("agreedAmount", new BigDecimal("1000000.00")),
            new Case("agreedAmount", null),
            new Case("description", ""),
            new Case("description", "   "),
            new Case("description", "x".repeat(1001)),
            new Case("description", "pago con tarjeta 4111 1111 1111 1111"),
            new Case("description", "bad\u0000char"),
            new Case("customerEmail", "not-an-email"),
            new Case("customerEmail", ""),
            new Case("customerEmail", "a".repeat(250) + "@example.test"),
            new Case("paymentConfirmed", false),
            new Case("paymentConfirmed", null),
        };
        for (Case c : cases) {
            Map<String, Object> b = body(email);
            b.put(c.field(), c.value());
            register(advisor, null, b)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[?(@.field == '" + c.field() + "')]").exists());
        }
        assertThat(clienteRepository.findByEmail(email)).isEmpty();
    }

    @Test
    void missingFieldsAreRejected() throws Exception {
        register(signInAs(Rol.ASESOR), null, Map.of()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void forgedStatusKindRegisteredByAndCustomerIdAreIgnored() throws Exception {
        String customerEmail = uniqueEmail("cust");
        Cliente customer = provision(customerEmail, Rol.CLIENTE);
        String advisorEmail = uniqueEmail("asesor");
        Cliente advisorAccount = provision(advisorEmail, Rol.ASESOR);
        Cliente other = provision(uniqueEmail("victim"), Rol.CLIENTE);
        Map<String, Object> b = body(customerEmail);
        b.put("status", "ENTREGADO");
        b.put("kind", "ESTANDAR");
        b.put("registeredBy", other.getId());
        b.put("registeredByEmail", "forged@example.test");
        b.put("customerId", other.getId());
        b.put("id", "PED-999999");
        b.put("totalAmount", 1);

        JsonNode json = read(register(signIn(advisorEmail), null, b).andExpect(status().isCreated()));
        Order stored = orderRepository.findById(json.get("id").asText()).orElseThrow();
        assertThat(stored.id()).isNotEqualTo("PED-999999");
        assertThat(stored.status()).isEqualTo(OrderStatus.CONFIRMADO);
        assertThat(stored.kind()).isEqualTo(OrderKind.PERSONALIZADO);
        assertThat(stored.registeredBy()).isEqualTo(advisorAccount.getId());
        assertThat(stored.customerId()).isEqualTo(customer.getId());
        assertThat(stored.total()).isEqualByComparingTo("150.50");
        assertThat(json.get("registeredBy").asText()).isEqualTo(advisorEmail);
    }

    // ---------- idempotency ----------

    @Test
    void sameKeyAndBodyReplaysTheOriginalOrder() throws Exception {
        String customerEmail = uniqueEmail("cust");
        Cookie advisor = signInAs(Rol.ASESOR);
        String key = UUID.randomUUID().toString();

        JsonNode first = read(register(advisor, key, body(customerEmail)).andExpect(status().isCreated()));
        JsonNode second = read(register(advisor, key.toUpperCase(), body(customerEmail))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true")));

        assertThat(second.get("id").asText()).isEqualTo(first.get("id").asText());
        assertThat(orderRepository.findByCustomerId(idOf(customerEmail))).hasSize(1);
    }

    @Test
    void sameKeyWithDifferentBodyIsConflict() throws Exception {
        String customerEmail = uniqueEmail("cust");
        Cookie advisor = signInAs(Rol.ASESOR);
        String key = UUID.randomUUID().toString();
        register(advisor, key, body(customerEmail)).andExpect(status().isCreated());

        Map<String, Object> changed = body(customerEmail);
        changed.put("agreedAmount", new BigDecimal("999.00"));
        register(advisor, key, changed).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
        assertThat(orderRepository.findByCustomerId(idOf(customerEmail))).hasSize(1);
    }

    @Test
    void keyIsScopedPerStaffActor() throws Exception {
        String customerEmail = uniqueEmail("cust");
        String key = UUID.randomUUID().toString();
        register(signInAs(Rol.ASESOR), key, body(customerEmail)).andExpect(status().isCreated());
        register(signInAs(Rol.ASESOR), key, body(customerEmail)).andExpect(status().isCreated());
        assertThat(orderRepository.findByCustomerId(idOf(customerEmail))).hasSize(2);
    }

    @Test
    void malformedIdempotencyKeyIsRejected() throws Exception {
        register(signInAs(Rol.ASESOR), "not-a-uuid", body(uniqueEmail("c"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void failedAttemptDoesNotConsumeTheKey() throws Exception {
        String email = uniqueEmail("off");
        Cliente c = provision(email, Rol.CLIENTE);
        clienteRepository.save(c.withActive(false));
        Cookie advisor = signInAs(Rol.ASESOR);
        String key = UUID.randomUUID().toString();
        register(advisor, key, body(email)).andExpect(status().isConflict());
        clienteRepository.save(c.withActive(true));
        register(advisor, key, body(email)).andExpect(status().isCreated());
    }
}
