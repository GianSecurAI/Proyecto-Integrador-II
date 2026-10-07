package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.testsupport.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * POST/GET /api/checkout over HTTP (MockMvc, nodb, full Spring Security chain, manual Yape/Plin flow):
 * server-side pricing, forged fields, validation, role and ownership access, idempotency, the open-checkout cap,
 * price snapshot, and "no order exists before payment".
 */
class CheckoutApiTest extends AbstractCheckoutApiTest {

    private static void assertMoney(JsonNode node, String expected) {
        assertThat(node.decimalValue()).isEqualByComparingTo(new BigDecimal(expected));
    }

    // ---------- happy path ----------

    @Test
    void validCheckoutIsCreatedPendingWithServerPricesAndNoOrderYet() throws Exception {
        long p1 = createProduct("21.90");
        long p2 = createProduct("14.50");
        String email = uniqueEmail("buyer");
        Cookie customer = signIn(email);
        emailSender.clear();

        JsonNode body = read(submit(customer, checkoutBody(item(p1, 2), item(p2, 3)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.checkoutId").value(org.hamcrest.Matchers.matchesPattern("[0-9a-f-]{36}")))
                .andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"))
                .andExpect(jsonPath("$.orderId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.currency").value("PEN"))
                .andExpect(jsonPath("$.expiresAt").isString())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.paymentInstructions.methods[0]").value("YAPE"))
                .andExpect(jsonPath("$.paymentInstructions.methods[1]").value("PLIN"))
                .andExpect(jsonPath("$.paymentInstructions.currency").value("PEN"))
                .andExpect(jsonPath("$.paymentInstructions.reference").value(org.hamcrest.Matchers.matchesPattern("AM3D-[0-9A-F]{8}")))
                .andExpect(jsonPath("$.proofStatus").value("NONE"))
                .andExpect(jsonPath("$.attemptsRemaining").value(5))
                .andExpect(jsonPath("$.attempts.length()").value(0)));
        assertMoney(body.get("items").get(0).get("unitPrice"), "21.90");
        assertMoney(body.get("items").get(0).get("lineTotal"), "43.80");
        assertMoney(body.get("items").get(1).get("lineTotal"), "43.50");
        assertMoney(body.get("totalAmount"), "87.30");
        assertMoney(body.get("paymentInstructions").get("amount"), "87.30");
        assertThat(body.get("paymentInstructions").get("reference").asText())
                .isEqualTo("AM3D-" + body.get("checkoutId").asText().substring(0, 8).toUpperCase());

        // nothing is an order until the payment is confirmed; nothing is e-mailed either
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
        assertThat(emailSender.getSent()).isEmpty();
    }

    @Test
    void theResponseNeverCarriesCardDataTokensOrSecrets() throws Exception {
        long p = createProduct("10.00");
        String raw = submit(signIn(uniqueEmail("clean")), checkoutBody(item(p, 1)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(raw).doesNotContainIgnoringCase("card").doesNotContainIgnoringCase("token").doesNotContainIgnoringCase("sha256").doesNotContainIgnoringCase("storageKey");
    }

    @Test
    void textFieldsAreTrimmedAndBlankNotesAreAccepted() throws Exception {
        long p = createProduct("10.00");
        Map<String, Object> body = checkoutBody(item(p, 1));
        body.put("delivery", new LinkedHashMap<>(Map.of("address", "  Calle 1  ", "district", " Surco ", "notes", "   ")));
        submit(signIn(uniqueEmail("trim")), body).andExpect(status().isCreated());
    }

    // ---------- manipulated client data ----------

    @Test
    void forgedPriceTotalStatusCustomerAndPaymentDataInTheBodyHaveNoEffect() throws Exception {
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
        Map<String, Object> body = checkoutBody(line);
        body.put("total", 0.01);
        body.put("totalAmount", 0.01);
        body.put("amount", 1);
        body.put("currency", "USD");
        body.put("status", "PAID");
        body.put("orderId", "PED-999999");
        body.put("customerId", idOf(victim));
        body.put("email", victim);
        body.put("rol", "ADMINISTRADOR");
        body.put("id", "forged");
        body.put("provider", "evil");
        body.put("providerRef", "x");
        body.put("payment", Map.of("cardNumber", "4111111111111111", "token", "tok_forged"));

        JsonNode created = read(submit(customer, body).andExpect(status().isCreated()));

        assertMoney(created.get("totalAmount"), "40.00");
        assertMoney(created.get("items").get(0).get("unitPrice"), "20.00");
        assertThat(created.get("items").get(0).get("title").asText()).isNotEqualTo("Hacked");
        assertThat(created.get("status").asText()).isEqualTo("AWAITING_PAYMENT_PROOF");
        assertThat(created.get("orderId").isNull()).isTrue();
        assertThat(created.get("currency").asText()).isEqualTo("PEN");
        assertThat(created.get("checkoutId").asText()).isNotEqualTo("forged");
        // owned by the caller, not the victim
        poll(customer, created.get("checkoutId").asText()).andExpect(status().isOk());
        assertThat(orderRepository.findByCustomerId(idOf(victim))).isEmpty();
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }

    // ---------- products ----------

    @Test
    void unknownProductIsRejectedWithPerLineFieldErrors() throws Exception {
        long good = createProduct("5.00");
        submit(signIn(uniqueEmail("unknown")), checkoutBody(item(good, 1), item(987_654_321L, 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRODUCT_UNAVAILABLE"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(1))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items[1].productId"));
    }

    @Test
    void unavailableProductIsRejectedLikeAnUnknownOneAndNoCheckoutRowCountsTowardTheCap() throws Exception {
        long p = createProduct("5.00");
        long good = createProduct("6.00");
        setAvailable(p, false);
        Cookie customer = signIn(uniqueEmail("unavail"));
        for (int i = 0; i < 5; i++) {
            submit(customer, checkoutBody(item(p, 1)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("PRODUCT_UNAVAILABLE"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("items[0].productId"));
        }
        // five rejected attempts left no checkout behind: the full cap of 3 is still available
        for (int i = 0; i < 3; i++) {
            submit(customer, checkoutBody(item(good, 1))).andExpect(status().isCreated());
        }
    }

    // ---------- validation ----------

    @Test
    void emptyOrMissingItemsAreRejected() throws Exception {
        Cookie customer = signIn(uniqueEmail("empty"));
        submit(customer, checkoutBody()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        Map<String, Object> missing = checkoutBody();
        missing.remove("items");
        submit(customer, missing).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void invalidQuantitiesAreRejected() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("qty"));
        for (Object quantity : new Object[] {0, -1, 100, 1000, null}) {
            submit(customer, checkoutBody(item(p, quantity)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("items[0].quantity"));
        }
    }

    @Test
    void nonIntegerQuantitiesAreRejectedNotCoerced() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("nonint"));
        for (String quantityJson : new String[] {"2.5", "\"2\"", "\"abc\"", "true", "[2]"}) {
            String raw = "{\"items\":[{\"productId\":" + p + ",\"quantity\":" + quantityJson + "}],"
                    + "\"delivery\":{\"address\":\"A\",\"district\":\"B\"},"
                    + "\"contact\":{\"fullName\":\"N\",\"phone\":\"123456\"}}";
            mockMvc.perform(post("/api/checkout").cookie(customer).contentType(MediaType.APPLICATION_JSON).content(raw))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void duplicateProductLinesAreRejectedNotMerged() throws Exception {
        long p = createProduct("5.00");
        submit(signIn(uniqueEmail("dup")), checkoutBody(item(p, 1), item(p, 2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items[1].productId"));
    }

    @Test
    void moreThanFiftyLinesAreRejected() throws Exception {
        List<Map<String, Object>> items = new ArrayList<>();
        for (long i = 1; i <= 51; i++) {
            items.add(item(i, 1));
        }
        Map<String, Object> body = checkoutBody();
        body.put("items", items);
        submit(signIn(uniqueEmail("many")), body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void deliveryAndContactFieldsAreValidatedAndLengthLimited() throws Exception {
        long p = createProduct("5.00");
        Cookie customer = signIn(uniqueEmail("fields"));

        Map<String, Object> noDelivery = checkoutBody(item(p, 1));
        noDelivery.remove("delivery");
        submit(customer, noDelivery).andExpect(status().isBadRequest());

        Map<String, Object> blankAddress = checkoutBody(item(p, 1));
        blankAddress.put("delivery", Map.of("address", "   ", "district", "Surco"));
        submit(customer, blankAddress).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("delivery.address"));

        Map<String, Object> longAddress = checkoutBody(item(p, 1));
        longAddress.put("delivery", Map.of("address", "x".repeat(201), "district", "Surco"));
        submit(customer, longAddress).andExpect(status().isBadRequest());

        Map<String, Object> longNotes = checkoutBody(item(p, 1));
        longNotes.put("delivery", Map.of("address", "Calle", "district", "Surco", "notes", "n".repeat(301)));
        submit(customer, longNotes).andExpect(status().isBadRequest());

        Map<String, Object> badPhone = checkoutBody(item(p, 1));
        badPhone.put("contact", Map.of("fullName", "Ana", "phone", "abc"));
        submit(customer, badPhone).andExpect(status().isBadRequest());

        Map<String, Object> noContact = checkoutBody(item(p, 1));
        noContact.remove("contact");
        submit(customer, noContact).andExpect(status().isBadRequest());
    }

    @Test
    void controlCharactersAreRejectedInSingleLineFields() throws Exception {
        long p = createProduct("5.00");
        Map<String, Object> body = checkoutBody(item(p, 1));
        body.put("delivery", Map.of("address", "Calle 1\nFAKE audit line", "district", "Surco"));
        submit(signIn(uniqueEmail("ctrl")), body).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("delivery.address"));
    }

    @Test
    void malformedJsonIsAnErrorEnvelopeNotAStackTrace() throws Exception {
        mockMvc.perform(post("/api/checkout")
                        .cookie(signIn(uniqueEmail("badjson")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    // ---------- authentication, roles, ownership ----------

    @Test
    void unauthenticatedCallerGets401OnBothEndpoints() throws Exception {
        mockMvc.perform(post("/api/checkout").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        poll(null, UUID.randomUUID().toString()).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void advisorAndAdministratorGet403OnBothEndpointsAndNothingIsCreated() throws Exception {
        long p = createProduct("5.00");
        Cookie owner = signIn(uniqueEmail("owner"));
        String checkoutId = startCheckout(owner, p, 1);
        for (Rol rol : new Rol[] {Rol.ASESOR, Rol.ADMINISTRADOR}) {
            Cookie staff = signInAs(rol);
            submit(staff, checkoutBody(item(p, 1))).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            poll(staff, checkoutId).andExpect(status().isForbidden());
        }
    }

    @Test
    void theOwnerReadsTheStatusAndAnotherCustomerGetsTheSame404AsForAnUnknownId() throws Exception {
        long p = createProduct("5.00");
        Cookie owner = signIn(uniqueEmail("owner"));
        Cookie other = signIn(uniqueEmail("other"));
        String checkoutId = startCheckout(owner, p, 2);

        poll(owner, checkoutId).andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutId").value(checkoutId))
                .andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"))
                .andExpect(jsonPath("$.orderId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.totalAmount").value(10.0))
                .andExpect(jsonPath("$.currency").value("PEN"));

        String notOwned = poll(other, checkoutId).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND")).andReturn().getResponse().getContentAsString();
        String unknown = poll(other, UUID.randomUUID().toString()).andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        String malformed = poll(other, "not-a-uuid").andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(notOwned).get("message")).isEqualTo(objectMapper.readTree(unknown).get("message"));
        assertThat(objectMapper.readTree(malformed).get("code").asText()).isEqualTo("NOT_FOUND");
    }

    // ---------- total calculation and price snapshot ----------

    @Test
    void totalIsTheSumOfLineTotalsForManyLines() throws Exception {
        long a = createProduct("0.10");
        long b = createProduct("0.20");
        long c = createProduct("99999.99");
        JsonNode body = read(submit(signIn(uniqueEmail("sum")), checkoutBody(item(a, 3), item(b, 3), item(c, 99)))
                .andExpect(status().isCreated()));
        assertMoney(body.get("items").get(0).get("lineTotal"), "0.30");
        assertMoney(body.get("items").get(1).get("lineTotal"), "0.60");
        assertMoney(body.get("items").get(2).get("lineTotal"), "9899999.01");
        assertMoney(body.get("totalAmount"), "9899999.91");
    }

    @Test
    void laterCatalogPriceChangesDoNotAlterAnExistingCheckoutButApplyToTheNextOne() throws Exception {
        long p = createProduct("30.00");
        Cookie customer = signIn(uniqueEmail("snap"));
        String first = startCheckout(customer, p, 2);
        changePrice(p, "99.00");

        poll(customer, first).andExpect(jsonPath("$.totalAmount").value(60.0));
        JsonNode second = read(submit(customer, checkoutBody(item(p, 2))).andExpect(status().isCreated()));
        assertMoney(second.get("totalAmount"), "198.00");
        assertThat(second.get("checkoutId").asText()).isNotEqualTo(first);
    }

    // ---------- idempotency ----------

    @Test
    void sameKeyAndSameBodyReturnsTheOriginalCheckoutWith200() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("idem"));
        String key = UUID.randomUUID().toString();

        JsonNode first = read(submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));
        JsonNode replay = read(submit(customer, key.toUpperCase(), checkoutBody(item(p, 1)))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true")));

        assertThat(replay).isEqualTo(first);
        // still one provider payment and one open checkout: a third distinct checkout is fine, the replay used no slot
        for (int i = 0; i < 2; i++) {
            submit(customer, checkoutBody(item(p, 1))).andExpect(status().isCreated());
        }
        submit(customer, checkoutBody(item(p, 1))).andExpect(status().isConflict());
    }

    @Test
    void replayReturnsTheOriginalSnapshotEvenAfterAPriceChange() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("idem-price"));
        String key = UUID.randomUUID().toString();
        JsonNode first = read(submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));
        changePrice(p, "50.00");
        JsonNode replay = read(submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isOk()));
        assertThat(replay).isEqualTo(first);
        assertMoney(replay.get("totalAmount"), "12.00");
    }

    @Test
    void sameKeyWithADifferentBodyIsRejected() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("idem-diff"));
        String key = UUID.randomUUID().toString();
        submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isCreated());
        submit(customer, key, checkoutBody(item(p, 2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
        Map<String, Object> otherAddress = checkoutBody(item(p, 1));
        otherAddress.put("delivery", Map.of("address", "Otra calle 9", "district", "Miraflores"));
        submit(customer, key, otherAddress)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void keysAreScopedPerCustomer() throws Exception {
        long p = createProduct("12.00");
        Cookie a = signIn(uniqueEmail("scope-a"));
        Cookie b = signIn(uniqueEmail("scope-b"));
        String key = UUID.randomUUID().toString();
        JsonNode checkoutA = read(submit(a, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));
        JsonNode checkoutB = read(submit(b, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));
        assertThat(checkoutB.get("checkoutId").asText()).isNotEqualTo(checkoutA.get("checkoutId").asText());
    }

    @Test
    void aKeyIsForgottenAfterItsTtl() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("ttl");
        Cookie customer = signIn(email);
        String key = UUID.randomUUID().toString();
        JsonNode first = read(submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));

        ((MutableClock) clock).advance(Duration.ofHours(25));
        Cookie again = signIn(email); // the 24h session expired with the clock jump
        JsonNode second = read(submit(again, key, checkoutBody(item(p, 1))).andExpect(status().isCreated()));
        assertThat(second.get("checkoutId").asText()).isNotEqualTo(first.get("checkoutId").asText());
    }

    @Test
    void aMalformedKeyIsRejected() throws Exception {
        long p = createProduct("12.00");
        Cookie customer = signIn(uniqueEmail("badkey"));
        for (String key : new String[] {"not-a-uuid", "", "   ", "1-1-1-1-1"}) {
            submit(customer, key, checkoutBody(item(p, 1)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
        }
    }

    @Test
    void aFailedSubmissionDoesNotConsumeTheKey() throws Exception {
        long p = createProduct("12.00");
        setAvailable(p, false);
        Cookie customer = signIn(uniqueEmail("retry"));
        String key = UUID.randomUUID().toString();
        submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isConflict());
        setAvailable(p, true);
        submit(customer, key, checkoutBody(item(p, 1))).andExpect(status().isCreated());
    }

    // ---------- open checkout cap and expiry ----------

    @Test
    void theFourthOpenCheckoutIsRejectedAndFreesUpWhenOneExpires() throws Exception {
        long p = createProduct("12.00");
        String capEmail = uniqueEmail("cap");
        Cookie customer = signIn(capEmail);
        for (int i = 0; i < 3; i++) {
            submit(customer, checkoutBody(item(p, 1))).andExpect(status().isCreated());
        }
        submit(customer, checkoutBody(item(p, 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        // another customer is unaffected
        submit(signIn(uniqueEmail("cap-other")), checkoutBody(item(p, 1))).andExpect(status().isCreated());

        // after the TTL the three are no longer open
        ((MutableClock) clock).advance(Duration.ofHours(25));
        Cookie again = signIn(capEmail);
        submit(again, checkoutBody(item(p, 1))).andExpect(status().isCreated());
    }

    @Test
    void aPendingCheckoutBecomesExpiredWhenPolledAfterItsTtl() throws Exception {
        long p = createProduct("12.00");
        String email = uniqueEmail("expire");
        Cookie customer = signIn(email);
        String checkoutId = startCheckout(customer, p, 1);

        poll(customer, checkoutId).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"));
        ((MutableClock) clock).advance(Duration.ofHours(25));
        Cookie again = signIn(email);
        poll(again, checkoutId).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXPIRED"))
                .andExpect(jsonPath("$.orderId").value(org.hamcrest.Matchers.nullValue()));
        assertThat(orderRepository.findByCustomerId(idOf(email))).isEmpty();
    }
}
