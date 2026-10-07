package com.armakers3d.incidents;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.incidents.domain.IncidentRules;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Stage 12 over HTTP (MockMvc, nodb, full security chain): customer registration with order ownership,
 * customer list/detail (own only, 404 otherwise), staff list/detail/triage/resolution, every allowed and
 * rejected status transition, priority, resolution rules, validation, paging/filter/sort, role access and audit.
 */
class IncidentApiTest extends AbstractNoDbRbacTest {

    @Autowired private OrderRepository orders;

    private ListAppender<ILoggingEvent> auditLogs;
    private Logger auditLogger;

    @BeforeEach
    void captureAudit() {
        auditLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.incidents");
        auditLogs = new ListAppender<>();
        auditLogs.start();
        auditLogger.addAppender(auditLogs);
        auditLogger.setLevel(Level.INFO);
    }

    @AfterEach
    void releaseAudit() {
        auditLogger.detachAppender(auditLogs);
    }

    // ---------- helpers ----------

    private record Customer(String email, Long id, Cookie cookie) {}

    private Customer customer() throws Exception {
        String email = uniqueEmail("cust");
        Cookie cookie = signIn(email);
        return new Customer(email, idOf(email), cookie);
    }

    private Order orderOf(Long customerId) {
        return orders.save(Order.placeStandard(
                orders.nextOrderNumber(), customerId, List.of(new OrderLine(1L, "Llavero", new BigDecimal("12.50"), 2)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), clock.instant()));
    }

    private static String desc(String marker) {
        return "Problema con la pieza recibida " + marker + " " + UUID.randomUUID();
    }

    private ResultActions send(Cookie cookie, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req)
            throws Exception {
        if (cookie != null) {
            req.cookie(cookie);
        }
        return mockMvc.perform(req);
    }

    private ResultActions getAs(Cookie cookie, String url) throws Exception {
        return send(cookie, get(url));
    }

    private ResultActions register(Cookie cookie, Object body) throws Exception {
        return send(cookie, post("/api/incidents").contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private ResultActions triage(Cookie cookie, String incidentId, Object body) throws Exception {
        return send(cookie, patch("/api/admin/incidents/" + incidentId)
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private ResultActions resolve(Cookie cookie, String incidentId, Object body) throws Exception {
        return send(cookie, post("/api/admin/incidents/" + incidentId + "/resolution")
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private JsonNode read(ResultActions a) throws Exception {
        return objectMapper.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private static Map<String, Object> newBody(String orderId, String description) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("orderId", orderId);
        m.put("description", description);
        return m;
    }

    /** Registers an incident for the customer's own fresh order and returns its JSON. */
    private JsonNode incidentFor(Customer c) throws Exception {
        return read(register(c.cookie(), newBody(orderOf(c.id()).id(), desc("base"))).andExpect(status().isCreated()));
    }

    private Cookie staff(Rol rol) throws Exception {
        return signInAs(rol);
    }

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("content").forEach(n -> ids.add(n.get("id").asText()));
        return ids;
    }

    private void toReview(Cookie staff, String id) throws Exception {
        triage(staff, id, Map.of("status", "EN_REVISION")).andExpect(status().isOk());
    }

    // ---------- BE-04: allowedNextStatuses ----------

    @Test
    void staffResponsesCarryAllowedNextStatusesForEveryIncidentStatus() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        Customer c = customer();
        JsonNode created = incidentFor(c);
        String id = created.get("id").asText();

        JsonNode open = read(getAs(s, "/api/admin/incidents/" + id).andExpect(status().isOk()));
        assertThat(allowed(open)).containsExactly("EN_REVISION");

        JsonNode review = read(triage(s, id, Map.of("status", "EN_REVISION")).andExpect(status().isOk()));
        assertThat(allowed(review)).containsExactly("RESUELTA", "RECHAZADA");
        // the list rows carry it too
        assertThat(allowed(read(getAs(s, "/api/admin/incidents/" + id)))).containsExactly("RESUELTA", "RECHAZADA");
        // RESUELTA is still not settable through PATCH
        triage(s, id, Map.of("status", "RESUELTA")).andExpect(status().isBadRequest());

        JsonNode resolved = read(resolve(s, id, Map.of("resolutionText", "Listo")).andExpect(status().isOk()));
        assertThat(allowed(resolved)).isEmpty();

        String other = incidentFor(customer()).get("id").asText();
        toReview(s, other);
        JsonNode rejected = read(triage(s, other, Map.of("status", "RECHAZADA")).andExpect(status().isOk()));
        assertThat(allowed(rejected)).isEmpty();
    }

    private static List<String> allowed(JsonNode incident) {
        List<String> out = new ArrayList<>();
        incident.get("allowedNextStatuses").forEach(n -> out.add(n.asText()));
        return out;
    }

    // ---------- customer: register ----------

    @Test
    void customerRegistersAnIncidentForTheirOwnOrder() throws Exception {
        Customer c = customer();
        Order order = orderOf(c.id());
        String description = desc("own");

        String body = register(c.cookie(), newBody(order.id(), description))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern("/api/incidents/INC-\\d{6}")))
                .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.matchesPattern("INC-\\d{6}")))
                .andExpect(jsonPath("$.orderId").value(order.id()))
                .andExpect(jsonPath("$.orderSummary").value(org.hamcrest.Matchers.containsString("Llavero")))
                .andExpect(jsonPath("$.description").value(description))
                .andExpect(jsonPath("$.status").value("ABIERTA"))
                .andExpect(jsonPath("$.resolution").value((Object) null))
                .andExpect(jsonPath("$.reportedAt").value(clock.instant().toString()))
                .andExpect(jsonPath("$.resolvedAt").value((Object) null))
                .andReturn().getResponse().getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        assertThat(json.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "id", "orderId", "orderSummary", "description", "status", "resolution", "reportedAt", "resolvedAt");
        assertThat(body).doesNotContain("priority").doesNotContain("customerId");
    }

    @Test
    void theDescriptionIsTrimmedAndMultilineIsAllowed() throws Exception {
        Customer c = customer();
        String text = "Linea uno del problema\nlinea dos del problema " + UUID.randomUUID();
        register(c.cookie(), newBody(orderOf(c.id()).id(), "   " + text + "   "))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").value(text));
    }

    @Test
    void forgedStatusPriorityResolutionOwnerAndIdFieldsAreIgnored() throws Exception {
        Customer c = customer();
        Customer other = customer();
        Map<String, Object> body = newBody(orderOf(c.id()).id(), desc("forged"));
        body.put("status", "RESUELTA");
        body.put("priority", "ALTA");
        body.put("resolution", "Ya resuelto por mi");
        body.put("resolvedAt", "2020-01-01T00:00:00Z");
        body.put("customerId", other.id());
        body.put("id", "INC-000001");

        JsonNode created = read(register(c.cookie(), body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ABIERTA"))
                .andExpect(jsonPath("$.resolution").value((Object) null))
                .andExpect(jsonPath("$.resolvedAt").value((Object) null)));
        assertThat(created.get("id").asText()).isNotEqualTo("INC-000001");

        // Owned by the principal, default priority MEDIA, visible to the principal and not to the forged owner.
        getAs(c.cookie(), "/api/incidents/" + created.get("id").asText()).andExpect(status().isOk());
        getAs(other.cookie(), "/api/incidents/" + created.get("id").asText()).andExpect(status().isNotFound());
        getAs(staff(Rol.ASESOR), "/api/admin/incidents/" + created.get("id").asText())
                .andExpect(status().isOk()).andExpect(jsonPath("$.priority").value("MEDIA"))
                .andExpect(jsonPath("$.customerEmail").value(c.email()));
    }

    @Test
    void anotherCustomersOrderAndAnUnknownOrderAreTheSame404() throws Exception {
        Customer me = customer();
        Customer other = customer();
        Order theirs = orderOf(other.id());

        var notOwned = register(me.cookie(), newBody(theirs.id(), desc("x")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andReturn().getResponse().getContentAsString();
        var unknown = register(me.cookie(), newBody("PED-999999", desc("x")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andReturn().getResponse().getContentAsString();
        var malformed = register(me.cookie(), newBody("no-es-un-pedido", desc("x")))
                .andExpect(status().isNotFound()).andReturn().getResponse().getContentAsString();

        assertThat(objectMapper.readTree(notOwned).get("message")).isEqualTo(objectMapper.readTree(unknown).get("message"));
        assertThat(objectMapper.readTree(notOwned).get("message")).isEqualTo(objectMapper.readTree(malformed).get("message"));
        assertThat(notOwned).doesNotContain(theirs.id());
        // nothing was created for either customer
        assertThat(ids(read(getAs(me.cookie(), "/api/incidents")))).isEmpty();
        assertThat(ids(read(getAs(other.cookie(), "/api/incidents")))).isEmpty();
    }

    @Test
    void registrationValidationReturns400WithFieldErrors() throws Exception {
        Customer c = customer();
        String order = orderOf(c.id()).id();
        String longText = "x".repeat(IncidentRules.DESCRIPTION_MAX + 1);

        record Case(Object body, String field) {}
        List<Case> cases = List.of(
                new Case(Map.of("orderId", order), "description"),
                new Case(Map.of("description", desc("m")), "orderId"),
                new Case(newBody(order, ""), "description"),
                new Case(newBody(order, "   \n  "), "description"),
                new Case(newBody(order, "demasiado corto"), "description"),
                new Case(newBody(order, "   " + "a".repeat(19) + "   "), "description"),
                new Case(newBody(order, longText), "description"),
                new Case(newBody(order, "Texto largo valido\u0000con caracter de control"), "description"),
                new Case(newBody(order, "Texto largo valido\u001bcon escape de terminal"), "description"),
                new Case(newBody(" ", desc("m")), "orderId"),
                new Case(newBody("PED-" + "9".repeat(40), desc("m")), "orderId"));
        for (Case tc : cases) {
            JsonNode err = read(register(c.cookie(), tc.body()).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")));
            List<String> fields = new ArrayList<>();
            err.get("fieldErrors").forEach(f -> fields.add(f.get("field").asText()));
            assertThat(fields).as(tc.body().toString()).contains(tc.field());
        }
        // exact boundaries are accepted
        register(c.cookie(), newBody(order, "a".repeat(IncidentRules.DESCRIPTION_MIN))).andExpect(status().isCreated());
        register(c.cookie(), newBody(order, "b".repeat(IncidentRules.DESCRIPTION_MAX))).andExpect(status().isCreated());
        // an unreadable body is the generic malformed-request error
        send(c.cookie(), post("/api/incidents").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void anOrderAcceptsMultipleIncidentsUpToTheOpenCapAndRejectsAnIdenticalOpenOne() throws Exception {
        Customer c = customer();
        String order = orderOf(c.id()).id();
        String same = desc("dup");
        register(c.cookie(), newBody(order, same)).andExpect(status().isCreated());
        register(c.cookie(), newBody(order, same)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        for (int i = 1; i < IncidentRules.MAX_OPEN_PER_ORDER; i++) {
            register(c.cookie(), newBody(order, desc("n" + i))).andExpect(status().isCreated());
        }
        register(c.cookie(), newBody(order, desc("over"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        assertThat(read(getAs(c.cookie(), "/api/incidents")).get("totalElements").asInt())
                .isEqualTo(IncidentRules.MAX_OPEN_PER_ORDER);
    }

    @Test
    void aClosedIncidentNoLongerCountsTowardsTheCapOrTheDuplicateGuard() throws Exception {
        Customer c = customer();
        String order = orderOf(c.id()).id();
        String text = desc("again");
        String id = read(register(c.cookie(), newBody(order, text)).andExpect(status().isCreated())).get("id").asText();
        Cookie s = staff(Rol.ASESOR);
        toReview(s, id);
        triage(s, id, Map.of("status", "RECHAZADA")).andExpect(status().isOk());
        register(c.cookie(), newBody(order, text)).andExpect(status().isCreated());
    }

    // ---------- customer: list / detail ----------

    @Test
    void customerListsOnlyOwnIncidentsNewestFirstWithThePageEnvelope() throws Exception {
        Customer me = customer();
        Customer other = customer();
        String first = incidentFor(me).get("id").asText();
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        String second = incidentFor(me).get("id").asText();
        incidentFor(other);

        JsonNode page = read(getAs(me.cookie(), "/api/incidents").andExpect(status().isOk()));
        assertThat(ids(page)).containsExactly(second, first);
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.get("totalElements").asInt()).isEqualTo(2);
        assertThat(page.get("totalPages").asInt()).isEqualTo(1);
        assertThat(page.get("content").get(0).has("priority")).isFalse();
        assertThat(ids(read(getAs(me.cookie(), "/api/incidents?sort=reportedAt,asc")))).containsExactly(first, second);
    }

    @Test
    void customerListFiltersByStatusAndPages() throws Exception {
        Customer me = customer();
        Cookie s = staff(Rol.ASESOR);
        String a = incidentFor(me).get("id").asText();
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        String b = incidentFor(me).get("id").asText();
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        String c = incidentFor(me).get("id").asText();
        toReview(s, b);

        assertThat(ids(read(getAs(me.cookie(), "/api/incidents?status=EN_REVISION")))).containsExactly(b);
        assertThat(ids(read(getAs(me.cookie(), "/api/incidents?status=ABIERTA")))).containsExactly(c, a);
        assertThat(ids(read(getAs(me.cookie(), "/api/incidents?status=RESUELTA")))).isEmpty();
        JsonNode second = read(getAs(me.cookie(), "/api/incidents?size=2&page=1"));
        assertThat(ids(second)).containsExactly(a);
        assertThat(second.get("totalElements").asInt()).isEqualTo(3);
        assertThat(second.get("totalPages").asInt()).isEqualTo(2);
    }

    @Test
    void customerListRejectsBadPagingSortAndFilterValues() throws Exception {
        Customer me = customer();
        for (String q : List.of("size=101", "size=0", "page=-1")) {
            getAs(me.cookie(), "/api/incidents?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String q : List.of("sort=priority", "sort=reportedAt,sideways", "status=NOPE", "size=abc")) {
            getAs(me.cookie(), "/api/incidents?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
        getAs(me.cookie(), "/api/incidents?size=100").andExpect(status().isOk());
    }

    @Test
    void aForgedCustomerIdParameterNeverWidensTheCustomerList() throws Exception {
        Customer me = customer();
        Customer other = customer();
        incidentFor(other);
        assertThat(read(getAs(me.cookie(), "/api/incidents?customerId=" + other.id())).get("content")).isEmpty();
    }

    @Test
    void customerSeesStatusAndResolutionOfTheirOwnIncident() throws Exception {
        Customer me = customer();
        String id = incidentFor(me).get("id").asText();
        Cookie s = staff(Rol.ASESOR);
        toReview(s, id);
        ((MutableClock) clock).advance(Duration.ofMinutes(5));
        resolve(s, id, Map.of("resolutionText", "Reenviamos la pieza")).andExpect(status().isOk());

        getAs(me.cookie(), "/api/incidents/" + id).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESUELTA"))
                .andExpect(jsonPath("$.resolution").value("Reenviamos la pieza"))
                .andExpect(jsonPath("$.resolvedAt").value(clock.instant().toString()))
                .andExpect(jsonPath("$.priority").doesNotExist());
    }

    @Test
    void anotherCustomersIncidentAndAnUnknownIdAreTheSame404() throws Exception {
        Customer me = customer();
        Customer other = customer();
        String theirs = incidentFor(other).get("id").asText();

        String notOwned = getAs(me.cookie(), "/api/incidents/" + theirs).andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        String unknown = getAs(me.cookie(), "/api/incidents/INC-999999").andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(notOwned).get("code")).isEqualTo(objectMapper.readTree(unknown).get("code"));
        assertThat(objectMapper.readTree(notOwned).get("message")).isEqualTo(objectMapper.readTree(unknown).get("message"));
        assertThat(notOwned).doesNotContain(theirs);
    }

    // ---------- customer cannot triage ----------

    @Test
    void customerCannotChangeStatusPriorityOrResolutionAndNothingChanges() throws Exception {
        Customer me = customer();
        String id = incidentFor(me).get("id").asText();

        triage(me.cookie(), id, Map.of("status", "RESUELTA", "priority", "ALTA")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        triage(me.cookie(), id, Map.of("priority", "ALTA")).andExpect(status().isForbidden());
        resolve(me.cookie(), id, Map.of("resolutionText", "Resuelto")).andExpect(status().isForbidden());
        getAs(me.cookie(), "/api/admin/incidents").andExpect(status().isForbidden());
        getAs(me.cookie(), "/api/admin/incidents/" + id).andExpect(status().isForbidden());
        // PATCH/PUT/DELETE on the customer path do not exist
        send(me.cookie(), patch("/api/incidents/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"RESUELTA\"}"))
                .andExpect(status().isMethodNotAllowed());

        getAs(me.cookie(), "/api/incidents/" + id).andExpect(jsonPath("$.status").value("ABIERTA"))
                .andExpect(jsonPath("$.resolution").value((Object) null));
        getAs(staff(Rol.ADMINISTRADOR), "/api/admin/incidents/" + id).andExpect(jsonPath("$.priority").value("MEDIA"));
    }

    // ---------- anonymous / roles ----------

    @Test
    void anonymousGets401OnEveryIncidentEndpoint() throws Exception {
        getAs(null, "/api/incidents").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        getAs(null, "/api/incidents/INC-000001").andExpect(status().isUnauthorized());
        register(null, newBody("PED-000001", desc("a"))).andExpect(status().isUnauthorized());
        getAs(null, "/api/admin/incidents").andExpect(status().isUnauthorized());
        getAs(null, "/api/admin/incidents/INC-000001").andExpect(status().isUnauthorized());
        triage(null, "INC-000001", Map.of("priority", "ALTA")).andExpect(status().isUnauthorized());
        resolve(null, "INC-000001", Map.of("resolutionText", "x")).andExpect(status().isUnauthorized());
    }

    @Test
    void staffCannotUseTheCustomerIncidentEndpoints() throws Exception {
        Customer c = customer();
        String id = incidentFor(c).get("id").asText();
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie s = staff(rol);
            getAs(s, "/api/incidents").andExpect(status().isForbidden());
            getAs(s, "/api/incidents/" + id).andExpect(status().isForbidden());
            register(s, newBody(orderOf(c.id()).id(), desc("staff"))).andExpect(status().isForbidden());
        }
    }

    @Test
    void unlistedIncidentPathsAreDenied() throws Exception {
        Cookie admin = staff(Rol.ADMINISTRADOR);
        Cookie cust = customer().cookie();
        getAs(admin, "/api/admin/incidents/INC-000001/history").andExpect(status().isForbidden());
        getAs(cust, "/api/incidents/INC-000001/resolution").andExpect(status().isForbidden());
    }

    // ---------- staff: list / detail ----------

    @Test
    void asesorAndAdministradorListFilterSortAndPage() throws Exception {
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie s = staff(rol);
            Customer c = customer();
            String marker = "marca" + UUID.randomUUID().toString().replace("-", "");
            Order order = orderOf(c.id());
            String a = read(register(c.cookie(), newBody(order.id(), "Pieza rota " + marker + " uno")).andExpect(status().isCreated())).get("id").asText();
            ((MutableClock) clock).advance(Duration.ofMinutes(1));
            String b = read(register(c.cookie(), newBody(order.id(), "Pieza rota " + marker + " DOS")).andExpect(status().isCreated())).get("id").asText();
            ((MutableClock) clock).advance(Duration.ofMinutes(1));
            String d = read(register(c.cookie(), newBody(order.id(), "Color incorrecto " + marker + " tres")).andExpect(status().isCreated())).get("id").asText();
            toReview(s, b);
            triage(s, d, Map.of("priority", "ALTA")).andExpect(status().isOk());

            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker.toUpperCase()).andExpect(status().isOk()))))
                    .containsExactly(d, b, a);
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker + "&sort=reportedAt,asc")))).containsExactly(a, b, d);
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=pieza rota " + marker)))).containsExactly(b, a);
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker + "&status=EN_REVISION")))).containsExactly(b);
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker + "&priority=ALTA")))).containsExactly(d);
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker + "&priority=BAJA")))).isEmpty();
            assertThat(ids(read(getAs(s, "/api/admin/incidents?q=" + marker + "&status=ABIERTA&priority=MEDIA")))).containsExactly(a);
            JsonNode p2 = read(getAs(s, "/api/admin/incidents?q=" + marker + "&size=2&page=1"));
            assertThat(ids(p2)).containsExactly(a);
            assertThat(p2.get("totalElements").asInt()).isEqualTo(3);
            assertThat(p2.get("totalPages").asInt()).isEqualTo(2);

            JsonNode row = read(getAs(s, "/api/admin/incidents?q=" + marker + "&size=1")).get("content").get(0);
            assertThat(row.fieldNames()).toIterable().containsExactlyInAnyOrder(
                    "id", "orderId", "orderSummary", "description", "status", "priority", "resolution", "reportedAt",
                    "updatedAt", "resolvedAt", "customerEmail", "customerName", "customerPhone", "allowedNextStatuses");
            assertThat(row.get("customerEmail").asText()).isEqualTo(c.email());
            assertThat(row.get("customerName").isNull()).isTrue();
        }
    }

    @Test
    void staffListRejectsBadParameters() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        for (String q : List.of("size=101", "size=0", "page=-1", "q=" + "x".repeat(101))) {
            getAs(s, "/api/admin/incidents?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String q : List.of("sort=priority", "sort=reportedAt,up", "status=NOPE", "priority=URGENTE")) {
            getAs(s, "/api/admin/incidents?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
    }

    @Test
    void staffDetailAndUnknownIncident() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        Customer c = customer();
        JsonNode created = incidentFor(c);
        getAs(s, "/api/admin/incidents/" + created.get("id").asText()).andExpect(status().isOk())
                .andExpect(jsonPath("$.customerEmail").value(c.email()))
                .andExpect(jsonPath("$.priority").value("MEDIA"))
                .andExpect(jsonPath("$.updatedAt").value(created.get("reportedAt").asText()));
        getAs(s, "/api/admin/incidents/INC-999999").andExpect(status().isNotFound());
        triage(s, "INC-999999", Map.of("priority", "ALTA")).andExpect(status().isNotFound());
        resolve(s, "INC-999999", Map.of("resolutionText", "x")).andExpect(status().isNotFound());
    }

    // ---------- staff: status transitions ----------

    @Test
    void asesorAndAdministradorDriveTheAllowedTransitions() throws Exception {
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie s = staff(rol);
            Customer c = customer();

            String toReject = incidentFor(c).get("id").asText();
            ((MutableClock) clock).advance(Duration.ofMinutes(2));
            triage(s, toReject, Map.of("status", "EN_REVISION")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("EN_REVISION"))
                    .andExpect(jsonPath("$.updatedAt").value(clock.instant().toString()))
                    .andExpect(jsonPath("$.resolvedAt").value((Object) null));
            triage(s, toReject, Map.of("status", "RECHAZADA")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("RECHAZADA"))
                    .andExpect(jsonPath("$.resolution").value((Object) null))
                    .andExpect(jsonPath("$.resolvedAt").value((Object) null));

            String toResolve = incidentFor(c).get("id").asText();
            toReview(s, toResolve);
            resolve(s, toResolve, Map.of("resolutionText", "  Se repuso la pieza  ")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("RESUELTA"))
                    .andExpect(jsonPath("$.resolution").value("Se repuso la pieza"))
                    .andExpect(jsonPath("$.resolvedAt").value(clock.instant().toString()));
        }
    }

    @Test
    void everyRejectedTransitionIs409AndLeavesTheIncidentUntouched() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        Customer c = customer();

        // From ABIERTA: only EN_REVISION is allowed.
        String open = incidentFor(c).get("id").asText();
        for (String target : List.of("ABIERTA", "RECHAZADA")) {
            triage(s, open, Map.of("status", target)).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        }
        resolve(s, open, Map.of("resolutionText", "Resuelto sin revisar")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        getAs(s, "/api/admin/incidents/" + open).andExpect(jsonPath("$.status").value("ABIERTA"))
                .andExpect(jsonPath("$.resolution").value((Object) null));

        // From EN_REVISION: ABIERTA and EN_REVISION (same) are rejected.
        toReview(s, open);
        for (String target : List.of("ABIERTA", "EN_REVISION")) {
            triage(s, open, Map.of("status", target)).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        }

        // Terminal RECHAZADA: nothing moves, no resolution.
        String rejected = incidentFor(c).get("id").asText();
        toReview(s, rejected);
        triage(s, rejected, Map.of("status", "RECHAZADA")).andExpect(status().isOk());
        for (String target : List.of("ABIERTA", "EN_REVISION", "RECHAZADA")) {
            triage(s, rejected, Map.of("status", target)).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        }
        resolve(s, rejected, Map.of("resolutionText", "Ya no")).andExpect(status().isConflict());
        getAs(s, "/api/admin/incidents/" + rejected).andExpect(jsonPath("$.status").value("RECHAZADA"))
                .andExpect(jsonPath("$.resolution").value((Object) null));

        // Terminal RESUELTA: every status move and a second resolution are rejected, the first resolution stays.
        String resolved = incidentFor(c).get("id").asText();
        toReview(s, resolved);
        resolve(s, resolved, Map.of("resolutionText", "Primera resolucion")).andExpect(status().isOk());
        for (String target : List.of("ABIERTA", "EN_REVISION", "RECHAZADA")) {
            triage(s, resolved, Map.of("status", target)).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        }
        resolve(s, resolved, Map.of("resolutionText", "Segunda resolucion")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        getAs(s, "/api/admin/incidents/" + resolved).andExpect(jsonPath("$.status").value("RESUELTA"))
                .andExpect(jsonPath("$.resolution").value("Primera resolucion"));
    }

    @Test
    void resolvedCannotBeSetThroughThePatchAndABodyWithoutFieldsIsInvalid() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        String id = incidentFor(customer()).get("id").asText();
        toReview(s, id);
        for (String from : List.of("RESUELTA")) {
            JsonNode err = read(triage(s, id, Map.of("status", from)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")));
            assertThat(err.get("fieldErrors").get(0).get("field").asText()).isEqualTo("status");
        }
        triage(s, id, Map.of()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        triage(s, id, Map.of("status", "NOPE")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        triage(s, id, Map.of("priority", "URGENTE")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        getAs(s, "/api/admin/incidents/" + id).andExpect(jsonPath("$.status").value("EN_REVISION"));
    }

    // ---------- staff: priority ----------

    @Test
    void staffAssignsPriorityAtAnyTimeAndTheNewIncidentDefaultsToMedia() throws Exception {
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie s = staff(rol);
            String id = incidentFor(customer()).get("id").asText();
            getAs(s, "/api/admin/incidents/" + id).andExpect(jsonPath("$.priority").value("MEDIA"));
            for (String p : List.of("ALTA", "BAJA", "MEDIA")) {
                ((MutableClock) clock).advance(Duration.ofSeconds(30));
                triage(s, id, Map.of("priority", p)).andExpect(status().isOk())
                        .andExpect(jsonPath("$.priority").value(p))
                        .andExpect(jsonPath("$.status").value("ABIERTA"))
                        .andExpect(jsonPath("$.updatedAt").value(clock.instant().toString()));
            }
        }
    }

    @Test
    void settingTheSamePriorityIsANoOpAndDoesNotTouchUpdatedAt() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        JsonNode created = incidentFor(customer());
        ((MutableClock) clock).advance(Duration.ofMinutes(3));
        triage(s, created.get("id").asText(), Map.of("priority", "MEDIA")).andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedAt").value(created.get("reportedAt").asText()));
    }

    @Test
    void aCombinedChangeIsAtomicAnIllegalStatusKeepsThePriorityUntouched() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        String id = incidentFor(customer()).get("id").asText();
        triage(s, id, Map.of("status", "RECHAZADA", "priority", "ALTA")).andExpect(status().isConflict());
        getAs(s, "/api/admin/incidents/" + id).andExpect(jsonPath("$.priority").value("MEDIA"))
                .andExpect(jsonPath("$.status").value("ABIERTA"));
        triage(s, id, Map.of("status", "EN_REVISION", "priority", "ALTA")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EN_REVISION")).andExpect(jsonPath("$.priority").value("ALTA"));
    }

    @Test
    void priorityCanStillBeTriagedOnAClosedIncident() throws Exception {
        Cookie s = staff(Rol.ADMINISTRADOR);
        String id = incidentFor(customer()).get("id").asText();
        toReview(s, id);
        resolve(s, id, Map.of("resolutionText", "Listo")).andExpect(status().isOk());
        triage(s, id, Map.of("priority", "BAJA")).andExpect(status().isOk())
                .andExpect(jsonPath("$.priority").value("BAJA")).andExpect(jsonPath("$.status").value("RESUELTA"))
                .andExpect(jsonPath("$.resolution").value("Listo"));
    }

    // ---------- staff: resolution rules ----------

    @Test
    void resolutionTextIsRequiredTrimmedLimitedAndFreeOfControlCharacters() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        String id = incidentFor(customer()).get("id").asText();
        toReview(s, id);
        List<Object> bad = List.of(
                Map.of(), Map.of("resolutionText", ""), Map.of("resolutionText", "   \n "),
                Map.of("resolutionText", "x".repeat(IncidentRules.RESOLUTION_MAX + 1)),
                Map.of("resolutionText", "texto\u0000nulo"), Map.of("resolutionText", "texto\u001bescape"));
        for (Object body : bad) {
            JsonNode err = read(resolve(s, id, body).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")));
            assertThat(err.get("fieldErrors").get(0).get("field").asText()).isEqualTo("resolutionText");
        }
        getAs(s, "/api/admin/incidents/" + id).andExpect(jsonPath("$.status").value("EN_REVISION"))
                .andExpect(jsonPath("$.resolution").value((Object) null));

        resolve(s, id, Map.of("resolutionText", "x".repeat(IncidentRules.RESOLUTION_MAX))).andExpect(status().isOk());
    }

    @Test
    void multilineResolutionIsAccepted() throws Exception {
        Cookie s = staff(Rol.ASESOR);
        String id = incidentFor(customer()).get("id").asText();
        toReview(s, id);
        resolve(s, id, Map.of("resolutionText", "Linea 1\nLinea 2")).andExpect(status().isOk())
                .andExpect(jsonPath("$.resolution").value("Linea 1\nLinea 2"));
    }

    // ---------- audit ----------

    @Test
    void auditLinesCarryActorAndIdsButNeverDescriptionOrResolutionText() throws Exception {
        Customer c = customer();
        String description = desc("secretdesc");
        String id = read(register(c.cookie(), newBody(orderOf(c.id()).id(), description)).andExpect(status().isCreated()))
                .get("id").asText();
        String staffEmail = uniqueEmail("auditor");
        provision(staffEmail, Rol.ASESOR);
        Cookie s = signIn(staffEmail);
        Long staffId = idOf(staffEmail);
        triage(s, id, Map.of("status", "EN_REVISION", "priority", "ALTA")).andExpect(status().isOk());
        resolve(s, id, Map.of("resolutionText", "secretresolution")).andExpect(status().isOk());
        triage(s, id, Map.of("status", "RECHAZADA")).andExpect(status().isConflict());

        List<String> lines = auditLogs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
        assertThat(lines).anyMatch(l -> l.startsWith("incident.created actor=" + c.id() + " incident=" + id));
        assertThat(lines).anyMatch(l -> l.equals("incident.status.changed actor=" + staffId + " role=ASESOR incident=" + id
                + " from=ABIERTA to=EN_REVISION"));
        assertThat(lines).anyMatch(l -> l.equals("incident.priority.changed actor=" + staffId + " role=ASESOR incident=" + id
                + " from=MEDIA to=ALTA"));
        assertThat(lines).anyMatch(l -> l.equals("incident.resolved actor=" + staffId + " role=ASESOR incident=" + id
                + " from=EN_REVISION to=RESUELTA"));
        assertThat(lines).anyMatch(l -> l.startsWith("incident.status.rejected actor=" + staffId));
        String all = String.join("\n", lines);
        assertThat(all).doesNotContain("secretdesc").doesNotContain("secretresolution").doesNotContain(staffEmail)
                .doesNotContain(c.email());
    }

    @Test
    void noEmailIsSentForIncidentActivity() throws Exception {
        Customer c = customer();
        Cookie s = staff(Rol.ASESOR);
        emailSender.clear();
        String id = incidentFor(c).get("id").asText();
        toReview(s, id);
        triage(s, id, Map.of("priority", "ALTA")).andExpect(status().isOk());
        resolve(s, id, Map.of("resolutionText", "Listo")).andExpect(status().isOk());
        assertThat(emailSender.getSent()).isEmpty();
    }
}
