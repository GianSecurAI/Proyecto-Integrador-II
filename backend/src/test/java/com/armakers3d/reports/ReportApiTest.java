package com.armakers3d.reports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.incidents.domain.Incident;
import com.armakers3d.incidents.domain.IncidentPriority;
import com.armakers3d.incidents.domain.IncidentStatus;
import com.armakers3d.incidents.repository.IncidentRepository;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Stage 13 over HTTP (MockMvc, nodb, full security chain): authorization (ADMINISTRADOR only), aggregation
 * correctness with seeded orders and incidents (kinds, statuses, Lima day boundaries, cancelled orders excluded
 * from the amounts, empty ranges), validation and audit. Seed data lives in fixed historical windows (2020, 2021)
 * so other tests sharing the in-memory repositories cannot interfere.
 */
class ReportApiTest extends AbstractNoDbRbacTest {

    private static final String ORDERS = "/api/admin/reports/orders";
    private static final String INCIDENTS = "/api/admin/reports/incidents";

    @Autowired private OrderRepository orders;
    @Autowired private IncidentRepository incidents;

    private ListAppender<ILoggingEvent> auditLogs;
    private Logger auditLogger;

    @BeforeEach
    void captureAudit() {
        auditLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.reports");
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

    private ResultActions getAs(Cookie cookie, String url) throws Exception {
        var req = get(url);
        if (cookie != null) {
            req.cookie(cookie);
        }
        return mockMvc.perform(req);
    }

    private JsonNode body(ResultActions a) throws Exception {
        return objectMapper.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private static BigDecimal amount(JsonNode n) {
        return n.decimalValue();
    }

    private static long countOf(JsonNode list, String key, String value) {
        for (JsonNode n : list) {
            if (n.get(key).asText().equals(value)) {
                return n.get("count").asLong();
            }
        }
        throw new AssertionError("no entry " + value);
    }

    /** Lima wall-clock to instant. */
    private static Instant lima(String isoLocalDateTime) {
        return java.time.LocalDateTime.parse(isoLocalDateTime).atZone(ZoneId.of("America/Lima")).toInstant();
    }

    private Order standard(String limaDateTime, String unitPrice, int qty, OrderStatus finalStatus) {
        Order o = Order.placeStandard(orders.nextOrderNumber(), 1L,
                List.of(new OrderLine(1L, "Pieza", new BigDecimal(unitPrice), qty)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"),
                lima(limaDateTime));
        for (OrderStatus step : path(finalStatus)) {
            o = o.transitionTo(step, 9L, Rol.ASESOR, null, lima(limaDateTime));
        }
        return orders.save(o);
    }

    private static List<OrderStatus> path(OrderStatus target) {
        return switch (target) {
            case CONFIRMADO -> List.of();
            case EN_PRODUCCION -> List.of(OrderStatus.EN_PRODUCCION);
            case ENVIADO -> List.of(OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO);
            case ENTREGADO -> List.of(OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO, OrderStatus.ENTREGADO);
            case CANCELADO -> List.of(OrderStatus.CANCELADO);
        };
    }

    private Order personalized(String limaDateTime, String agreed) {
        return orders.save(Order.registerPersonalized(orders.nextOrderNumber(), 1L, 9L, Rol.ASESOR,
                "Figura a medida", new BigDecimal(agreed), lima(limaDateTime)));
    }

    private Incident incident(String limaDateTime, IncidentStatus target, IncidentPriority priority) {
        Instant at = lima(limaDateTime);
        Incident i = Incident.open(incidents.nextIncidentNumber(), "PED-000001", 1L,
                "Pieza llego rota, descripcion de prueba", at);
        switch (target) {
            case ABIERTA -> i = i.triage(null, priority, at);
            case EN_REVISION -> i = i.triage(IncidentStatus.EN_REVISION, priority, at);
            case RESUELTA -> i = i.triage(IncidentStatus.EN_REVISION, priority, at).resolve("Reemplazo enviado", at);
            case RECHAZADA -> i = i.triage(IncidentStatus.EN_REVISION, priority, at)
                    .triage(IncidentStatus.RECHAZADA, null, at);
        }
        return incidents.save(i);
    }

    private static boolean ordersSeeded;
    private static boolean incidentsSeeded;

    /** Orders window March 2020 (Lima): 5 in range, 2 just outside. Seeded once (the repositories are shared). */
    private synchronized void seedMarch2020() {
        if (ordersSeeded) {
            return;
        }
        ordersSeeded = true;
        standard("2020-03-10T00:00:00", "12.50", 2, OrderStatus.CONFIRMADO); // 25.00, first instant of 03-10
        standard("2020-03-15T12:00:00", "10.00", 3, OrderStatus.ENTREGADO); // 30.00
        standard("2020-03-20T09:00:00", "100.00", 1, OrderStatus.CANCELADO); // 100.00, excluded from amounts
        personalized("2020-03-30T23:59:59", "250.00"); // CONFIRMADO
        personalized("2020-03-31T23:59:59", "80.00"); // last second of the inclusive end
        personalized("2020-04-01T00:00:00", "500.00"); // out: first instant after the end
        standard("2020-02-29T23:59:59", "999.00", 1, OrderStatus.CONFIRMADO); // out: last second before the start
    }

    private synchronized void seedJune2021() {
        if (incidentsSeeded) {
            return;
        }
        incidentsSeeded = true;
        incident("2021-06-10T10:00:00", IncidentStatus.ABIERTA, IncidentPriority.MEDIA);
        incident("2021-06-11T10:00:00", IncidentStatus.EN_REVISION, IncidentPriority.ALTA);
        incident("2021-06-12T10:00:00", IncidentStatus.RESUELTA, IncidentPriority.BAJA);
        incident("2021-06-30T23:59:59", IncidentStatus.RECHAZADA, IncidentPriority.ALTA); // last second, in
        incident("2021-07-01T00:00:00", IncidentStatus.ABIERTA, IncidentPriority.ALTA); // out
        incident("2021-05-31T23:59:59", IncidentStatus.ABIERTA, IncidentPriority.ALTA); // out
    }

    // ---------- authorization ----------

    @Test
    void adminGets200AdvisorAndCustomerGet403AnonymousGets401OnBothReports() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        Cookie advisor = signInAs(Rol.ASESOR);
        Cookie customer = signInAs(Rol.CLIENTE);
        for (String url : List.of(ORDERS, INCIDENTS)) {
            getAs(admin, url).andExpect(status().isOk());
            getAs(advisor, url).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            getAs(customer, url).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            getAs(null, url).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        }
    }

    @Test
    void unlistedReportPathsAreDeniedEvenToAdmin() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        getAs(admin, "/api/admin/reports").andExpect(status().isForbidden());
        getAs(admin, "/api/admin/reports/orders/export").andExpect(status().isForbidden());
        getAs(admin, "/api/admin/reports/orders.csv").andExpect(status().isForbidden());
    }

    @Test
    void reportsAreReadOnly() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        mockMvc.perform(post(ORDERS).cookie(admin)).andExpect(status().isMethodNotAllowed());
    }

    // ---------- order report ----------

    @Test
    void orderReportAggregatesCountsKindsAndAmountsExcludingCancelled() throws Exception {
        seedMarch2020();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode r = body(getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31").andExpect(status().isOk()));

        assertThat(r.get("from").asText()).isEqualTo("2020-03-01");
        assertThat(r.get("to").asText()).isEqualTo("2020-03-31");
        assertThat(r.get("totalOrders").asLong()).isEqualTo(5);
        assertThat(r.get("standardOrders").asLong()).isEqualTo(3);
        assertThat(r.get("customOrders").asLong()).isEqualTo(2);
        assertThat(r.get("byStatus")).hasSize(5);
        assertThat(r.get("byStatus").toString()).doesNotContain("PENDIENTE");
        assertThat(countOf(r.get("byStatus"), "status", "CONFIRMADO")).isEqualTo(3);
        assertThat(countOf(r.get("byStatus"), "status", "EN_PRODUCCION")).isZero();
        assertThat(countOf(r.get("byStatus"), "status", "ENTREGADO")).isEqualTo(1);
        assertThat(countOf(r.get("byStatus"), "status", "CANCELADO")).isEqualTo(1);
        // standard: 25.00 + 30.00 (the 100.00 cancelled order is excluded); custom: 250.00 + 80.00
        assertThat(amount(r.get("standardAmount"))).isEqualByComparingTo("55.00");
        assertThat(amount(r.get("customAmount"))).isEqualByComparingTo("330.00");
        assertThat(amount(r.get("totalAmount"))).isEqualByComparingTo("385.00");
    }

    @Test
    void orderReportRangeIsInclusiveInLimaTimeNotUtc() throws Exception {
        seedMarch2020();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        // 2020-03-10 00:00 Lima is 05:00Z: a UTC reading of the day would still include it, a Lima one must too.
        JsonNode oneDay = body(getAs(admin, ORDERS + "?from=2020-03-10&to=2020-03-10").andExpect(status().isOk()));
        assertThat(oneDay.get("totalOrders").asLong()).isEqualTo(1);

        // 2020-03-31 23:59:59 Lima is 2020-04-01T04:59:59Z: still the 31st; 04-01 00:00 Lima is the next day.
        JsonNode lastDay = body(getAs(admin, ORDERS + "?from=2020-03-31&to=2020-03-31"));
        assertThat(lastDay.get("totalOrders").asLong()).isEqualTo(1);
        assertThat(amount(lastDay.get("customAmount"))).isEqualByComparingTo("80.00");
        JsonNode firstApril = body(getAs(admin, ORDERS + "?from=2020-04-01&to=2020-04-01"));
        assertThat(firstApril.get("totalOrders").asLong()).isEqualTo(1);
        assertThat(amount(firstApril.get("customAmount"))).isEqualByComparingTo("500.00");
        JsonNode leapDay = body(getAs(admin, ORDERS + "?from=2020-02-29&to=2020-02-29"));
        assertThat(leapDay.get("totalOrders").asLong()).isEqualTo(1);
        assertThat(amount(leapDay.get("standardAmount"))).isEqualByComparingTo("999.00");
    }

    @Test
    void orderReportStatusFilterAndCancelledHaveZeroAmount() throws Exception {
        seedMarch2020();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode cancelled =
                body(getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31&status=CANCELADO").andExpect(status().isOk()));
        assertThat(cancelled.get("totalOrders").asLong()).isEqualTo(1);
        assertThat(cancelled.get("standardOrders").asLong()).isEqualTo(1);
        assertThat(countOf(cancelled.get("byStatus"), "status", "CANCELADO")).isEqualTo(1);
        assertThat(countOf(cancelled.get("byStatus"), "status", "CONFIRMADO")).isZero();
        assertThat(amount(cancelled.get("totalAmount"))).isEqualByComparingTo("0.00");

        JsonNode confirmed =
                body(getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31&status=CONFIRMADO").andExpect(status().isOk()));
        assertThat(confirmed.get("totalOrders").asLong()).isEqualTo(3);
        assertThat(amount(confirmed.get("totalAmount"))).isEqualByComparingTo("355.00");

        // PENDIENTE no longer exists on the wire (ADR-004 D-02).
        getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31&status=PENDIENTE").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void orderReportOnAnEmptyRangeReturnsZerosWithEveryStatusListed() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode r = body(getAs(admin, ORDERS + "?from=2001-01-01&to=2001-01-31").andExpect(status().isOk()));

        assertThat(r.get("totalOrders").asLong()).isZero();
        assertThat(r.get("standardOrders").asLong()).isZero();
        assertThat(r.get("customOrders").asLong()).isZero();
        assertThat(r.get("byStatus")).hasSize(5).allSatisfy(n -> assertThat(n.get("count").asLong()).isZero());
        assertThat(amount(r.get("totalAmount"))).isEqualByComparingTo("0");
    }

    @Test
    void orderReportContainsNoPersonalData() throws Exception {
        seedMarch2020();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        String raw = getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31").andReturn().getResponse().getContentAsString();

        assertThat(raw).doesNotContain("@").doesNotContain("email").doesNotContain("customer").doesNotContain("999888777");
        assertThat(objectMapper.readTree(raw).fieldNames()).toIterable().containsExactlyInAnyOrder(
                "from", "to", "totalOrders", "standardOrders", "customOrders", "byStatus", "totalAmount",
                "standardAmount", "customAmount");
    }

    @Test
    void omittedRangeDefaultsToTheLastThirtyDaysEndingTodayInLima() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("America/Lima")));

        JsonNode r = body(getAs(admin, ORDERS).andExpect(status().isOk()));

        assertThat(r.get("to").asText()).isEqualTo(today.toString());
        assertThat(r.get("from").asText()).isEqualTo(today.minusDays(29).toString());
        JsonNode onlyFrom = body(getAs(admin, ORDERS + "?from=" + today.minusDays(5)).andExpect(status().isOk()));
        assertThat(onlyFrom.get("to").asText()).isEqualTo(today.toString());
        JsonNode onlyTo = body(getAs(admin, INCIDENTS + "?to=2021-06-30").andExpect(status().isOk()));
        assertThat(onlyTo.get("from").asText()).isEqualTo("2021-06-01");
    }

    // ---------- incident report ----------

    @Test
    void incidentReportAggregatesStatusPriorityAndOpenVersusResolved() throws Exception {
        seedJune2021();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode r = body(getAs(admin, INCIDENTS + "?from=2021-06-01&to=2021-06-30").andExpect(status().isOk()));

        assertThat(r.get("totalIncidents").asLong()).isEqualTo(4);
        assertThat(r.get("openIncidents").asLong()).isEqualTo(2); // ABIERTA + EN_REVISION
        assertThat(r.get("resolvedIncidents").asLong()).isEqualTo(1); // RESUELTA only; RECHAZADA is neither
        assertThat(r.get("byStatus")).hasSize(4);
        assertThat(countOf(r.get("byStatus"), "status", "ABIERTA")).isEqualTo(1);
        assertThat(countOf(r.get("byStatus"), "status", "EN_REVISION")).isEqualTo(1);
        assertThat(countOf(r.get("byStatus"), "status", "RESUELTA")).isEqualTo(1);
        assertThat(countOf(r.get("byStatus"), "status", "RECHAZADA")).isEqualTo(1);
        assertThat(r.get("byPriority")).hasSize(3);
        assertThat(countOf(r.get("byPriority"), "priority", "BAJA")).isEqualTo(1);
        assertThat(countOf(r.get("byPriority"), "priority", "MEDIA")).isEqualTo(1);
        assertThat(countOf(r.get("byPriority"), "priority", "ALTA")).isEqualTo(2);
    }

    @Test
    void incidentReportStatusFilterAndEmptyRange() throws Exception {
        seedJune2021();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        JsonNode resolved =
                body(getAs(admin, INCIDENTS + "?from=2021-06-01&to=2021-06-30&status=RESUELTA").andExpect(status().isOk()));
        assertThat(resolved.get("totalIncidents").asLong()).isEqualTo(1);
        assertThat(resolved.get("openIncidents").asLong()).isZero();
        assertThat(resolved.get("resolvedIncidents").asLong()).isEqualTo(1);

        JsonNode empty = body(getAs(admin, INCIDENTS + "?from=2001-01-01&to=2001-01-31").andExpect(status().isOk()));
        assertThat(empty.get("totalIncidents").asLong()).isZero();
        assertThat(empty.get("byStatus")).hasSize(4).allSatisfy(n -> assertThat(n.get("count").asLong()).isZero());
        assertThat(empty.get("byPriority")).hasSize(3).allSatisfy(n -> assertThat(n.get("count").asLong()).isZero());
    }

    @Test
    void incidentReportRangeBoundariesUseLimaDays() throws Exception {
        seedJune2021();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        assertThat(body(getAs(admin, INCIDENTS + "?from=2021-06-30&to=2021-06-30")).get("totalIncidents").asLong())
                .isEqualTo(1);
        assertThat(body(getAs(admin, INCIDENTS + "?from=2021-07-01&to=2021-07-01")).get("totalIncidents").asLong())
                .isEqualTo(1);
        assertThat(body(getAs(admin, INCIDENTS + "?from=2021-05-31&to=2021-05-31")).get("totalIncidents").asLong())
                .isEqualTo(1);
    }

    @Test
    void incidentReportContainsNoDescriptionsOrContactData() throws Exception {
        seedJune2021();
        Cookie admin = signInAs(Rol.ADMINISTRADOR);

        String raw = getAs(admin, INCIDENTS + "?from=2021-06-01&to=2021-06-30").andReturn().getResponse()
                .getContentAsString();

        assertThat(raw).doesNotContain("rota").doesNotContain("Reemplazo").doesNotContain("@").doesNotContain("PED-");
    }

    // ---------- validation ----------

    @Test
    void invalidRangesAndFiltersAreRejectedWith400() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        for (String url : List.of(ORDERS, INCIDENTS)) {
            getAs(admin, url + "?from=2020-03-31&to=2020-03-01").andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("from"));
            getAs(admin, url + "?from=2020-13-45&to=2020-03-01").andExpect(status().isBadRequest());
            getAs(admin, url + "?from=abc").andExpect(status().isBadRequest());
            getAs(admin, url + "?to=31/03/2020").andExpect(status().isBadRequest());
            getAs(admin, url + "?from=2020-03-01T00:00:00&to=2020-03-31").andExpect(status().isBadRequest());
            getAs(admin, url + "?status=NOPE").andExpect(status().isBadRequest());
        }
        getAs(admin, ORDERS + "?status=RESUELTA").andExpect(status().isBadRequest()); // an incident status
        getAs(admin, INCIDENTS + "?status=PENDIENTE").andExpect(status().isBadRequest()); // an order status
    }

    @Test
    void rangeIsCappedAt366DaysInclusive() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        for (String url : List.of(ORDERS, INCIDENTS)) {
            // 2020 is a leap year: 2020-01-01..2020-12-31 is exactly 366 days
            getAs(admin, url + "?from=2020-01-01&to=2020-12-31").andExpect(status().isOk());
            getAs(admin, url + "?from=2020-01-01&to=2021-01-01").andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("to"));
            getAs(admin, url + "?from=1900-01-01&to=2100-01-01").andExpect(status().isBadRequest());
        }
    }

    @Test
    void errorResponsesLeakNoInternalDetails() throws Exception {
        Cookie admin = signInAs(Rol.ADMINISTRADOR);
        String raw = getAs(admin, ORDERS + "?from=zzz").andExpect(status().isBadRequest()).andReturn().getResponse()
                .getContentAsString();
        assertThat(raw).doesNotContain("Exception").doesNotContain("at com.").doesNotContain("java.");
    }

    // ---------- audit ----------

    @Test
    void everyGenerationIsAuditedWithActorFiltersAndNoReportData() throws Exception {
        seedMarch2020();
        String email = uniqueEmail("auditadmin");
        Long adminId = provision(email, Rol.ADMINISTRADOR).getId();
        Cookie admin = signIn(email);

        getAs(admin, ORDERS + "?from=2020-03-01&to=2020-03-31&status=CONFIRMADO").andExpect(status().isOk());
        getAs(admin, INCIDENTS + "?from=2021-06-01&to=2021-06-30").andExpect(status().isOk());
        getAs(admin, ORDERS + "?from=2020-03-31&to=2020-03-01").andExpect(status().isBadRequest());

        List<String> lines = auditLogs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
        assertThat(lines).hasSize(2); // a rejected request generated nothing
        assertThat(lines.get(0)).contains("report.generated", "actor=" + adminId, "role=ADMINISTRADOR", "report=orders",
                "from=2020-03-01", "to=2020-03-31", "status=CONFIRMADO");
        assertThat(lines.get(1)).contains("report=incidents", "status=null");
        assertThat(String.join(" ", lines)).doesNotContain("@").doesNotContain(email);
    }
}
