package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The functions the project document promises that were missing: profile data typed at registration (RF01),
 * quotations (RF08, RF09, RF11, RF17), buying again (RF14), the IT officer's monitoring and backups (RF18) and the
 * role catalogue (RF03). Whole application on the in-memory adapters, real security chain.
 */
class CompletenessApiTest extends AbstractCheckoutApiTest {

    private ResultActions getAs(Cookie cookie, String path) throws Exception {
        var request = get(path);
        if (cookie != null) {
            request.cookie(cookie);
        }
        return mockMvc.perform(request);
    }

    private ResultActions postAs(Cookie cookie, String path, Object body) throws Exception {
        return mockMvc.perform(post(path).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private ResultActions patchAs(Cookie cookie, String path, Object body) throws Exception {
        return mockMvc.perform(patch(path).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    // ---------------------------------------------------------------------------------------------- RF01 registration

    @Test
    void thePerfilTypedAtRegistrationIsSavedWhenTheFirstCodeCreatesTheAccount() throws Exception {
        String email = uniqueEmail("registro");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("email", email);
        request.put("firstName", "Ana");
        request.put("lastName", "Quispe");
        request.put("phone", "+51 999 888 777");
        mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(json(request)))
                .andExpect(status().isAccepted());
        var verify = mockMvc.perform(post("/api/auth/otp/verify").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "code", emailSender.lastCodeFor(email)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("created"))
                .andReturn();
        Cookie cookie = verify.getResponse().getCookie("ARM3D_SESSION");

        getAs(cookie, "/api/customers/me").andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Ana"))
                .andExpect(jsonPath("$.lastName").value("Quispe"))
                .andExpect(jsonPath("$.phone").value("+51 999 888 777"));
    }

    @Test
    void registrationDataSentForAnExistingAccountNeverOverwritesItsProfile() throws Exception {
        String email = uniqueEmail("existente");
        Cookie first = signIn(email);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/customers/me")
                        .cookie(first).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("firstName", "Original", "lastName", "Nombre", "phone", "911222333"))))
                .andExpect(status().isOk());

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("email", email);
        request.put("firstName", "Intruso");
        mockMvc.perform(post("/api/auth/otp/request").contentType(MediaType.APPLICATION_JSON).content(json(request)))
                .andExpect(status().isAccepted());
        var verify = mockMvc.perform(post("/api/auth/otp/verify").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "code", emailSender.lastCodeFor(email)))))
                .andExpect(jsonPath("$.accountStatus").value("existing"))
                .andReturn();

        getAs(verify.getResponse().getCookie("ARM3D_SESSION"), "/api/customers/me")
                .andExpect(jsonPath("$.firstName").value("Original"));
    }

    // ------------------------------------------------------------------------------------- RF08, RF09, RF11, RF17

    private Map<String, Object> quotationBody(String customerEmail, String amount) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customerEmail", customerEmail);
        body.put("description", "Llavero con el logo de la empresa, 50 unidades en PLA");
        body.put("agreedAmount", new java.math.BigDecimal(amount));
        body.put("notes", "Acordado por WhatsApp");
        return body;
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    @Test
    void anAdvisorRegistersAQuotationMovesItToAcceptedAndGeneratesTheOrderOnce() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        String customerEmail = uniqueEmail("cotiza");

        JsonNode created = body(postAs(advisor, "/api/admin/quotations", quotationBody(customerEmail, "250.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REGISTRADA"))
                .andExpect(jsonPath("$.customerEmail").value(customerEmail.toLowerCase())));
        long id = created.get("id").asLong();
        assertThat(created.get("orderId").isNull()).isTrue();

        getAs(advisor, "/api/admin/quotations?status=REGISTRADA").andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id==" + id + ")]").exists());
        getAs(advisor, "/api/admin/quotations/" + id).andExpect(status().isOk())
                .andExpect(jsonPath("$.allowedNextStatuses.length()").value(3));

        // RN08: only an accepted quotation can generate an order
        postAs(advisor, "/api/admin/quotations/" + id + "/order", Map.of("paymentConfirmed", true))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUOTATION_NOT_ACCEPTED"));

        patchAs(advisor, "/api/admin/quotations/" + id + "/status", Map.of("status", "ACEPTADA", "notes", "El cliente acepto"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACEPTADA"))
                .andExpect(jsonPath("$.notes").value("El cliente acepto"));

        postAs(advisor, "/api/admin/quotations/" + id + "/order", Map.of("paymentConfirmed", false))
                .andExpect(status().isBadRequest());
        JsonNode ordered = body(postAs(advisor, "/api/admin/quotations/" + id + "/order", Map.of("paymentConfirmed", true))
                .andExpect(status().isCreated()));
        String orderId = ordered.get("orderId").asText();
        assertThat(orderId).matches("PED-\\d{6}");

        postAs(advisor, "/api/admin/quotations/" + id + "/order", Map.of("paymentConfirmed", true))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUOTATION_ALREADY_ORDERED"));

        // the customer follows the generated order like any other
        Cookie customer = signIn(customerEmail);
        getAs(customer, "/api/orders/" + orderId).andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("PERSONALIZADO"))
                .andExpect(jsonPath("$.status").value("CONFIRMADO"));
        assertThat(emailSender.getSent())
                .anyMatch(m -> m.to().equalsIgnoreCase(customerEmail) && m.subject().toLowerCase().contains("pedido"));
    }

    @Test
    void quotationOutcomesAreFinalAndInputIsValidated() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        long id = body(postAs(advisor, "/api/admin/quotations", quotationBody(uniqueEmail("final"), "80.00"))
                .andExpect(status().isCreated())).get("id").asLong();

        patchAs(advisor, "/api/admin/quotations/" + id + "/status", Map.of("status", "RECHAZADA"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allowedNextStatuses.length()").value(0));
        patchAs(advisor, "/api/admin/quotations/" + id + "/status", Map.of("status", "ACEPTADA"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_QUOTATION_TRANSITION"));

        postAs(advisor, "/api/admin/quotations", quotationBody(uniqueEmail("neg"), "-5")).andExpect(status().isBadRequest());
        postAs(advisor, "/api/admin/quotations", quotationBody("no-es-correo", "10")).andExpect(status().isBadRequest());
        getAs(advisor, "/api/admin/quotations/999999").andExpect(status().isNotFound());
    }

    @Test
    void onlyStaffManageQuotationsAndOnlyTheAdministratorReadsTheirReport() throws Exception {
        Cookie customer = signInAs(Rol.CLIENTE);
        Cookie advisor = signInAs(Rol.ASESOR);
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        Cookie it = signInAs(Rol.RESPONSABLE_TI);

        getAs(null, "/api/admin/quotations").andExpect(status().isUnauthorized());
        getAs(customer, "/api/admin/quotations").andExpect(status().isForbidden());
        getAs(it, "/api/admin/quotations").andExpect(status().isForbidden());
        postAs(customer, "/api/admin/quotations", quotationBody(uniqueEmail("x"), "10")).andExpect(status().isForbidden());

        long id = body(postAs(advisor, "/api/admin/quotations", quotationBody(uniqueEmail("rep"), "120.50"))
                .andExpect(status().isCreated())).get("id").asLong();
        patchAs(advisor, "/api/admin/quotations/" + id + "/status", Map.of("status", "ACEPTADA")).andExpect(status().isOk());

        getAs(advisor, "/api/admin/reports/quotations").andExpect(status().isForbidden());
        JsonNode report = body(getAs(admin, "/api/admin/reports/quotations").andExpect(status().isOk()));
        assertThat(report.get("totalQuotations").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(report.get("byStatus").size()).isEqualTo(4);
        assertThat(report.get("acceptedAmount").decimalValue()).isGreaterThanOrEqualTo(new java.math.BigDecimal("120.50"));
        getAs(admin, "/api/admin/reports/quotations?from=2030-02-01&to=2030-01-01").andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------------------------------------------ RF14

    @Test
    void aCustomerCanBuyAgainFromTheHistoryAtTodaysPricesAndAvailability() throws Exception {
        long product = createProduct("20.00");
        Cookie customer = signInAs(Rol.CLIENTE);
        String checkout = checkoutWithProof(customer, product, 3, 11);
        String orderId = read(approve(checkout).andExpect(status().isOk())).get("orderId").asText();

        getAs(customer, "/api/orders/" + orderId + "/reorder").andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.items[0].productId").value(product))
                .andExpect(jsonPath("$.items[0].quantity").value(3))
                .andExpect(jsonPath("$.items[0].unitPrice").value(20.0))
                .andExpect(jsonPath("$.items[0].available").value(true))
                .andExpect(jsonPath("$.availableCount").value(1));

        changePrice(product, "26.50");
        getAs(customer, "/api/orders/" + orderId + "/reorder").andExpect(jsonPath("$.items[0].unitPrice").value(26.5));

        setAvailable(product, false);
        getAs(customer, "/api/orders/" + orderId + "/reorder")
                .andExpect(jsonPath("$.items[0].available").value(false))
                .andExpect(jsonPath("$.availableCount").value(0));

        Cookie other = signInAs(Rol.CLIENTE);
        getAs(other, "/api/orders/" + orderId + "/reorder").andExpect(status().isNotFound());
        getAs(null, "/api/orders/" + orderId + "/reorder").andExpect(status().isUnauthorized());
        getAs(signInAs(Rol.ASESOR), "/api/orders/" + orderId + "/reorder").andExpect(status().isForbidden());
    }

    @Test
    void aPersonalizedOrderCannotBeBoughtAgain() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        String customerEmail = uniqueEmail("personalizado");
        long id = body(postAs(advisor, "/api/admin/quotations", quotationBody(customerEmail, "99.00"))
                .andExpect(status().isCreated())).get("id").asLong();
        patchAs(advisor, "/api/admin/quotations/" + id + "/status", Map.of("status", "ACEPTADA")).andExpect(status().isOk());
        String orderId = body(postAs(advisor, "/api/admin/quotations/" + id + "/order", Map.of("paymentConfirmed", true))
                .andExpect(status().isCreated())).get("orderId").asText();

        getAs(signIn(customerEmail), "/api/orders/" + orderId + "/reorder")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_NOT_REORDERABLE"));
    }

    // ------------------------------------------------------------------------------------------------------ RF18

    @Test
    void theItOfficerSeesTheSystemStatusAndKeepsTheBackupLog() throws Exception {
        Cookie it = signInAs(Rol.RESPONSABLE_TI);

        getAs(it, "/api/admin/monitoring").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.javaVersion").isNotEmpty())
                .andExpect(jsonPath("$.persistence.orders").value("memory"));

        Map<String, Object> backup = new LinkedHashMap<>();
        backup.put("backupAt", Instant.now().minusSeconds(3600).toString());
        backup.put("type", "AUTOMATICO");
        backup.put("result", "EXITOSO");
        backup.put("restoreVerified", true);
        backup.put("detail", "Copia automatica diaria del servicio gestionado");
        postAs(it, "/api/admin/monitoring/backups", backup).andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber());

        getAs(it, "/api/admin/monitoring/backups").andExpect(status().isOk())
                .andExpect(jsonPath("$.health").value("OK"))
                .andExpect(jsonPath("$.lastVerifiedRestoreAt").isNotEmpty())
                .andExpect(jsonPath("$.recent[0].detail").value("Copia automatica diaria del servicio gestionado"));

        backup.put("result", "FALLIDO"); // a failed backup cannot have a verified restore
        postAs(it, "/api/admin/monitoring/backups", backup).andExpect(status().isBadRequest());
        backup.put("result", "EXITOSO");
        backup.put("backupAt", Instant.now().plusSeconds(86400).toString());
        postAs(it, "/api/admin/monitoring/backups", backup).andExpect(status().isBadRequest());
    }

    @Test
    void monitoringIsOnlyForTheItOfficerAndTheAdministratorAndTheOfficerSeesNothingElse() throws Exception {
        getAs(null, "/api/admin/monitoring").andExpect(status().isUnauthorized());
        getAs(signInAs(Rol.CLIENTE), "/api/admin/monitoring").andExpect(status().isForbidden());
        getAs(signInAs(Rol.ASESOR), "/api/admin/monitoring").andExpect(status().isForbidden());
        getAs(signInAs(Rol.ASESOR), "/api/admin/monitoring/backups").andExpect(status().isForbidden());
        getAs(signInAs(Rol.ADMINISTRADOR), "/api/admin/monitoring").andExpect(status().isOk());

        Cookie it = signInAs(Rol.RESPONSABLE_TI);
        getAs(it, "/api/auth/me").andExpect(status().isOk()).andExpect(jsonPath("$.role").value("RESPONSABLE_TI"));
        for (String forbidden : new String[] {"/api/admin/orders", "/api/admin/incidents", "/api/admin/users",
            "/api/admin/payments", "/api/admin/reports/orders", "/api/orders", "/api/admin/products"}) {
            getAs(it, forbidden).andExpect(status().isForbidden());
        }
    }

    // ------------------------------------------------------------------------------------------------------ RF03

    @Test
    void theAdministratorCanListTheRolesAndAssignTheItRole() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode roles = body(getAs(admin, "/api/admin/roles").andExpect(status().isOk()));
        assertThat(roles.findValuesAsText("name")).contains("CLIENTE", "ASESOR", "ADMINISTRADOR", "RESPONSABLE_TI");
        getAs(signInAs(Rol.ASESOR), "/api/admin/roles").andExpect(status().isForbidden());

        String email = uniqueEmail("ti");
        postAs(admin, "/api/admin/users", Map.of("email", email, "role", "RESPONSABLE_TI"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("RESPONSABLE_TI"));
        getAs(signIn(email), "/api/admin/monitoring").andExpect(status().isOk());
    }
}
