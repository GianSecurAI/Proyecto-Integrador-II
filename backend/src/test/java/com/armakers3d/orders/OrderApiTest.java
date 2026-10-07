package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * POST /api/orders over HTTP (MockMvc, nodb profile, full Spring Security chain): valid order,
 * server-side pricing, forged fields, validation, role access, idempotency, price snapshot.
 * Each test creates its own products through the admin API, so the shared context never interferes.
 */
class OrderApiTest extends AbstractNoDbRbacTest {

    @Autowired private OrderRepository orderRepository;

    private Cookie admin;

    private Cookie admin() throws Exception {
        if (admin == null) {
            admin = signInAs(Rol.ADMINISTRADOR);
        }
        return admin;
    }

    private static Map<String, Object> productBody(String price) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", "Producto " + UUID.randomUUID().toString().substring(0, 8));
        m.put("category", "LLAVERO");
        m.put("subcategory", "Subcategoria");
        m.put("description", "Descripcion del producto");
        m.put("price", new BigDecimal(price));
        m.put("characteristics", List.of());
        return m;
    }

    private long createProduct(String price) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/admin/products")
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(productBody(price))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private void changePrice(long id, String price) throws Exception {
        mockMvc.perform(put("/api/admin/products/" + id)
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(productBody(price))))
                .andExpect(status().isOk());
    }

    private void setAvailable(long id, boolean available) throws Exception {
        mockMvc.perform(patch("/api/admin/products/" + id + "/availability")
                        .cookie(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("available", available))))
                .andExpect(status().isOk());
    }

    private static Map<String, Object> item(Object productId, Object quantity) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("productId", productId);
        m.put("quantity", quantity);
        return m;
    }

    private static Map<String, Object> order(Map<String, Object>... items) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", List.of(items));
        m.put("delivery", new LinkedHashMap<>(Map.of("address", "Av. Siempre Viva 123", "district", "Miraflores", "notes", "Tocar el timbre")));
        m.put("contact", new LinkedHashMap<>(Map.of("fullName", "Ana Perez", "phone", "+51 999 888 777")));
        return m;
    }

    private ResultActions submit(Cookie cookie, String idempotencyKey, Object body) throws Exception {
        var request = post("/api/orders").cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json(body));
        if (idempotencyKey != null) {
            request.header("Idempotency-Key", idempotencyKey);
        }
        return mockMvc.perform(request);
    }

    private ResultActions submit(Cookie cookie, Object body) throws Exception {
        return submit(cookie, null, body);
    }

    private JsonNode read(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private static void assertMoney(JsonNode node, String expected) {
        assertThat(node.decimalValue()).isEqualByComparingTo(new BigDecimal(expected));
    }

    // ---------- happy path ----------

    @Test
    void validOrderIsCreatedWithServerPricesInitialStatusAndOwnerFromTheSession() throws Exception {
        long p1 = createProduct("21.90");
        long p2 = createProduct("14.50");
        String email = uniqueEmail("buyer");
        Cookie customer = signIn(email);

        ResultActions result = submit(customer, order(item(p1, 2), item(p2, 3)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.matchesPattern("PED-\\d{6}")))
                .andExpect(jsonPath("$.status").value("CONFIRMADO"))
                .andExpect(jsonPath("$.kind").value("ESTANDAR"))
                .andExpect(jsonPath("$.placedAt").isString())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.delivery.address").value("Av. Siempre Viva 123"))
                .andExpect(jsonPath("$.delivery.district").value("Miraflores"))
                .andExpect(jsonPath("$.delivery.notes").value("Tocar el timbre"))
                .andExpect(jsonPath("$.summary").value("5 unidades: " + titleOfFirstLine(p1) + " y 1 producto más"))
                // no payment data, no customer data in the response
                .andExpect(jsonPath("$.payment").doesNotExist())
                .andExpect(jsonPath("$.customerId").doesNotExist())
                .andExpect(jsonPath("$.contact").doesNotExist());
        JsonNode body = read(result);
        assertMoney(body.get("items").get(0).get("unitPrice"), "21.90");
        assertMoney(body.get("items").get(0).get("lineTotal"), "43.80");
        assertMoney(body.get("items").get(1).get("lineTotal"), "43.50");
        assertMoney(body.get("totalAmount"), "87.30");

        var stored = orderRepository.findByCustomerId(idOf(email));
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).id()).isEqualTo(body.get("id").asText());
    }

    private String titleOfFirstLine(long productId) throws Exception {
        // The public detail endpoint returns the authoritative title.
        var r = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/catalog/products/" + productId))
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("title").asText();
    }

    @Test
    void textFieldsAreTrimmedAndBlankNotesBecomeNull() throws Exception {
        long p = createProduct("10.00");
        Map<String, Object> body = order(item(p, 1));
        body.put("delivery", new LinkedHashMap<>(Map.of("address", "  Calle 1  ", "district", " Surco ", "notes", "   ")));
        submit(signIn(uniqueEmail("trim")), body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.delivery.address").value("Calle 1"))
                .andExpect(jsonPath("$.delivery.district").value("Surco"))
                .andExpect(jsonPath("$.delivery.notes").value(org.hamcrest.Matchers.nullValue()));
    }

    // ---------- manipulated client data ----------

    @Test
    void forgedPriceTotalStatusCustomerAndRoleInTheBodyHaveNoEffect() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("forger");
        String victim = uniqueEmail("victim");
        signIn(victim);
        Cookie customer = signIn(email);

        Map<String, Object> line = item(p, 2);
        line.put("unitPrice", 0.01);
        line.put("price", 0.01);
        line.put("subtotal", 0.02);
        line.put("lineTotal", 0.02);
        line.put("title", "Hacked");
        Map<String, Object> body = order(line);
        body.put("total", 0.01);
        body.put("totalAmount", 0.01);
        body.put("status", "ENTREGADO");
        body.put("kind", "PERSONALIZADO");
        body.put("customerId", idOf(victim));
        body.put("email", victim);
        body.put("rol", "ADMINISTRADOR");
        body.put("id", "PED-999999");
        body.put("createdAt", "2001-01-01T00:00:00Z");
        body.put("payment", Map.of("cardNumber", "4111111111111111"));

        JsonNode created = read(submit(customer, body).andExpect(status().isCreated()));

        assertMoney(created.get("totalAmount"), "40.00");
        assertMoney(created.get("items").get(0).get("unitPrice"), "20.00");
        assertThat(created.get("items").get(0).get("title").asText()).isNotEqualTo("Hacked");
        assertThat(created.get("status").asText()).isEqualTo("CONFIRMADO");
        assertThat(created.get("kind").asText()).isEqualTo("ESTANDAR");
        assertThat(created.get("id").asText()).isNotEqualTo("PED-999999");
        assertThat(created.get("placedAt").asText()).doesNotStartWith("2001");

        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
        assertThat(orderRepository.findByCustomerId(idOf(victim))).isEmpty();
    }

    // ---------- products ----------

    @Test
    void unknownProductIsRejectedWithPerLineFieldErrors() throws Exception {
        long good = createProduct("5.00");
        String email = uniqueEmail("unknown");
        submit(signIn(email), order(item(good, 1), item(987_654_321L, 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRODUCT_UNAVAILABLE"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(1))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items[1].productId"));
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }

    @Test
    void unavailableProductIsRejectedLikeAnUnknownOne() throws Exception {
        long p = createProduct("5.00");
        setAvailable(p, false);
        String email = uniqueEmail("unavail");
        submit(signIn(email), order(item(p, 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRODUCT_UNAVAILABLE"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items[0].productId"));
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }

    // ---------- validation ----------

    @Test
    void emptyOrMissingItemsAreRejected() throws Exception {
        Cookie customer = signIn(uniqueEmail("empty"));
        Map<String, Object> empty = order();
        submit(customer, empty).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        Map<String, Object> missing = order();
        missing.remove("items");
        submit(customer, missing).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void invalidQuantitiesAreRejected() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("qty"));
        for (Object quantity : new Object[] {0, -1, 100, 1000, null}) {
            submit(customer, order(item(p, quantity)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("items[0].quantity"));
        }
    }

    @Test
    void nonIntegerQuantitiesAreRejectedNotCoerced() throws Exception {
        long p = createProduct("5.00");
        String email = uniqueEmail("nonint");
        Cookie customer = signIn(email);
        for (String quantityJson : new String[] {"2.5", "\"2\"", "\"abc\"", "true", "[2]"}) {
            String raw = "{\"items\":[{\"productId\":" + p + ",\"quantity\":" + quantityJson + "}],"
                    + "\"delivery\":{\"address\":\"A\",\"district\":\"B\"},"
                    + "\"contact\":{\"fullName\":\"N\",\"phone\":\"123456\"}}";
            mockMvc.perform(post("/api/orders").cookie(customer).contentType(MediaType.APPLICATION_JSON).content(raw))
                    .andExpect(status().isBadRequest());
        }
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }

    @Test
    void duplicateProductLinesAreRejectedNotMerged() throws Exception {
        long p = createProduct("5.00");
        String email = uniqueEmail("dup");
        submit(signIn(email), order(item(p, 1), item(p, 2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items[1].productId"));
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }

    @Test
    void moreThanFiftyLinesAreRejected() throws Exception {
        List<Map<String, Object>> items = new ArrayList<>();
        for (long i = 1; i <= 51; i++) {
            items.add(item(i, 1));
        }
        Map<String, Object> body = order();
        body.put("items", items);
        submit(signIn(uniqueEmail("many")), body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void deliveryAndContactFieldsAreValidatedAndLengthLimited() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("fields"));

        Map<String, Object> noDelivery = order(item(p, 1));
        noDelivery.remove("delivery");
        submit(customer, noDelivery).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        Map<String, Object> blankAddress = order(item(p, 1));
        blankAddress.put("delivery", Map.of("address", "   ", "district", "Surco"));
        submit(customer, blankAddress).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("delivery.address"));

        Map<String, Object> longAddress = order(item(p, 1));
        longAddress.put("delivery", Map.of("address", "x".repeat(201), "district", "Surco"));
        submit(customer, longAddress).andExpect(status().isBadRequest());

        Map<String, Object> longNotes = order(item(p, 1));
        longNotes.put("delivery", Map.of("address", "Calle", "district", "Surco", "notes", "n".repeat(301)));
        submit(customer, longNotes).andExpect(status().isBadRequest());

        Map<String, Object> badPhone = order(item(p, 1));
        badPhone.put("contact", Map.of("fullName", "Ana", "phone", "abc"));
        submit(customer, badPhone).andExpect(status().isBadRequest());

        Map<String, Object> noContact = order(item(p, 1));
        noContact.remove("contact");
        submit(customer, noContact).andExpect(status().isBadRequest());
    }

    @Test
    void controlCharactersAreRejectedInSingleLineFields() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("ctrl"));
        Map<String, Object> body = order(item(p, 1));
        body.put("delivery", Map.of("address", "Calle 1\nFAKE audit line", "district", "Surco"));
        submit(customer, body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("delivery.address"));
    }

    @Test
    void malformedJsonIsAnErrorEnvelopeNotAStackTrace() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .cookie(signIn(uniqueEmail("badjson")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    // ---------- authentication and roles ----------

    @Test
    void unauthenticatedCallerGets401() throws Exception {
        mockMvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void advisorAndAdministratorGet403AndNoOrderIsCreated() throws Exception {
        long p = createProduct("5.00");
        for (Rol rol : new Rol[] {Rol.ASESOR, Rol.ADMINISTRADOR}) {
            String email = uniqueEmail(rol.name().toLowerCase());
            provision(email, rol);
            submit(signIn(email), order(item(p, 1)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
        }
    }

    // ---------- total calculation ----------

    @Test
    void totalIsTheSumOfLineTotalsForManyLines() throws Exception {
        long a = createProduct("0.10");
        long b = createProduct("0.20");
        long c = createProduct("99999.99");
        JsonNode body = read(submit(signIn(uniqueEmail("sum")), order(item(a, 3), item(b, 3), item(c, 99)))
                .andExpect(status().isCreated()));
        assertMoney(body.get("items").get(0).get("lineTotal"), "0.30");
        assertMoney(body.get("items").get(1).get("lineTotal"), "0.60");
        assertMoney(body.get("items").get(2).get("lineTotal"), "9899999.01");
        assertMoney(body.get("totalAmount"), "9899999.91");
    }

    // ---------- price snapshot ----------

    @Test
    void laterCatalogPriceChangesDoNotAlterAnExistingOrder() throws Exception {
        long p = createProduct("30.00");
        String email = uniqueEmail("snap");
        Cookie customer = signIn(email);
        JsonNode first = read(submit(customer, order(item(p, 2))).andExpect(status().isCreated()));
        assertMoney(first.get("totalAmount"), "60.00");

        changePrice(p, "99.00");

        var stored = orderRepository.findById(first.get("id").asText()).orElseThrow();
        assertThat(stored.total()).isEqualByComparingTo("60.00");
        assertThat(stored.lines().get(0).unitPrice()).isEqualByComparingTo("30.00");

        JsonNode second = read(submit(customer, order(item(p, 2))).andExpect(status().isCreated()));
        assertMoney(second.get("totalAmount"), "198.00");
        assertThat(second.get("id").asText()).isNotEqualTo(first.get("id").asText());
    }

    // ---------- idempotency ----------

    @Test
    void sameKeyAndSameBodyReturnsTheOriginalOrderWith200() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("idem");
        Cookie customer = signIn(email);
        String key = UUID.randomUUID().toString();

        JsonNode first = read(submit(customer, key, order(item(p, 1))).andExpect(status().isCreated()));
        // Same content in a different spelling (case of the key) is still the same submission.
        JsonNode replay = read(submit(customer, key.toUpperCase(), order(item(p, 1)))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true")));

        assertThat(replay).isEqualTo(first);
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
    }

    @Test
    void replayReturnsTheOriginalSnapshotEvenAfterAPriceChange() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("idem-price"));
        String key = UUID.randomUUID().toString();
        JsonNode first = read(submit(customer, key, order(item(p, 1))).andExpect(status().isCreated()));
        changePrice(p, "50.00");
        JsonNode replay = read(submit(customer, key, order(item(p, 1))).andExpect(status().isOk()));
        assertThat(replay).isEqualTo(first);
        assertMoney(replay.get("totalAmount"), "12.00");
    }

    @Test
    void sameKeyWithADifferentBodyIsRejectedAndCreatesNothing() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("idem-diff");
        Cookie customer = signIn(email);
        String key = UUID.randomUUID().toString();

        submit(customer, key, order(item(p, 1))).andExpect(status().isCreated());
        submit(customer, key, order(item(p, 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
        Map<String, Object> otherAddress = order(item(p, 1));
        otherAddress.put("delivery", Map.of("address", "Otra calle 9", "district", "Miraflores"));
        submit(customer, key, otherAddress)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));

        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
    }

    @Test
    void keysAreScopedPerCustomer() throws Exception {
        long p = createProduct("12.00");
        String emailA = uniqueEmail("scope-a");
        String emailB = uniqueEmail("scope-b");
        Cookie a = signIn(emailA);
        Cookie b = signIn(emailB);
        String key = UUID.randomUUID().toString();

        JsonNode orderA = read(submit(a, key, order(item(p, 1))).andExpect(status().isCreated()));
        JsonNode orderB = read(submit(b, key, order(item(p, 1))).andExpect(status().isCreated()));

        assertThat(orderB.get("id").asText()).isNotEqualTo(orderA.get("id").asText());
        assertThat(orderRepository.findByCustomerId(idOf(emailA))).hasSize(1);
        assertThat(orderRepository.findByCustomerId(idOf(emailB))).hasSize(1);
    }

    @Test
    void aKeyIsForgottenAfterItsTtl() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("ttl");
        Cookie customer = signIn(email);
        String key = UUID.randomUUID().toString();
        submit(customer, key, order(item(p, 1))).andExpect(status().isCreated());

        ((com.armakers3d.testsupport.MutableClock) clock).advance(java.time.Duration.ofHours(25));
        // Re-sign: the 24h session expired with the clock jump.
        Cookie again = signIn(email);
        submit(again, key, order(item(p, 1))).andExpect(status().isCreated());
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(2);
    }

    @Test
    void aMalformedKeyIsRejected() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("badkey"));
        for (String key : new String[] {"not-a-uuid", "", "   ", "1-1-1-1-1"}) {
            submit(customer, key, order(item(p, 1)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
        }
    }

    @Test
    void withoutAKeyEachSubmissionCreatesAnOrder() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("nokey");
        Cookie customer = signIn(email);
        submit(customer, order(item(p, 1))).andExpect(status().isCreated());
        submit(customer, order(item(p, 1))).andExpect(status().isCreated());
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(2);
    }

    @Test
    void aFailedSubmissionDoesNotConsumeTheKey() throws Exception {
        long p = createProduct("12.00");
        setAvailable(p, false);
        String email = uniqueEmail("retry");
        Cookie customer = signIn(email);
        String key = UUID.randomUUID().toString();

        submit(customer, key, order(item(p, 1))).andExpect(status().isConflict());
        setAvailable(p, true);
        submit(customer, key, order(item(p, 1))).andExpect(status().isCreated());
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
    }
}
