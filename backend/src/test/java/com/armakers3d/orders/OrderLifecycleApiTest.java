package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.ContactInfo;
import com.armakers3d.orders.domain.DeliveryInfo;
import com.armakers3d.orders.domain.InvalidStatusTransitionException;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderLine;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.orders.repository.OrderRepository;
import com.armakers3d.orders.service.OrderStatusChanged;
import com.armakers3d.orders.service.OrderStatusService;
import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.users.AbstractNoDbRbacTest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Stage 10 over HTTP (MockMvc, nodb, full security chain): customer list/detail (own orders only, 404
 * otherwise), staff list/detail/status change, transition enforcement for every from-to pair, history,
 * actor from the principal, concurrency, role access and the notification hook.
 */
@RecordApplicationEvents
class OrderLifecycleApiTest extends AbstractNoDbRbacTest {

    private static final ZoneId LIMA = ZoneId.of("America/Lima");

    @Autowired private OrderRepository orders;
    @Autowired private OrderStatusService statusService;
    @Autowired private ApplicationEvents events;

    private ListAppender<ILoggingEvent> auditLogs;
    private Logger auditLogger;

    @BeforeEach
    void captureAudit() {
        auditLogger = (Logger) LoggerFactory.getLogger("com.armakers3d.audit.orders");
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

    private static final List<OrderStatus> PATH_TO = List.of(
            OrderStatus.EN_PRODUCCION, OrderStatus.ENVIADO, OrderStatus.ENTREGADO);

    /** Stores a standard order for the customer, already advanced to {@code target} through the real domain transitions. */
    private Order orderAt(Long customerId, OrderStatus target) {
        Order o = Order.placeStandard(
                orders.nextOrderNumber(), customerId, List.of(new OrderLine(1L, "Llavero", new BigDecimal("12.50"), 2)),
                new DeliveryInfo("Calle 1", "Surco", null), new ContactInfo("Ana", "999888777"), clock.instant());
        if (target == OrderStatus.CANCELADO) {
            o = o.transitionTo(OrderStatus.CANCELADO, 1L, Rol.ASESOR, null, clock.instant());
        } else {
            for (OrderStatus step : PATH_TO) {
                if (o.status() == target) {
                    break;
                }
                o = o.transitionTo(step, 1L, Rol.ASESOR, null, clock.instant());
            }
        }
        assertThat(o.status()).isEqualTo(target);
        return orders.save(o);
    }

    private Order pending(Long customerId) {
        return orderAt(customerId, OrderStatus.CONFIRMADO);
    }

    private ResultActions changeStatus(Cookie cookie, String orderId, Object body) throws Exception {
        var req = patch("/api/admin/orders/" + orderId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body));
        if (cookie != null) {
            req.cookie(cookie);
        }
        return mockMvc.perform(req);
    }

    private ResultActions getAs(Cookie cookie, String url) throws Exception {
        var req = get(url);
        if (cookie != null) {
            req.cookie(cookie);
        }
        return mockMvc.perform(req);
    }

    private JsonNode read(ResultActions a) throws Exception {
        return objectMapper.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private Cookie staff(Rol rol, String email) throws Exception {
        provision(email, rol);
        return signIn(email);
    }

    // ---------- customer: list ----------

    @Test
    void customerListsOnlyOwnOrdersNewestFirstWithTheContractPageEnvelope() throws Exception {
        String email = uniqueEmail("mine");
        Cookie me = signIn(email);
        Long myId = idOf(email);
        Order first = pending(myId);
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        Order second = pending(myId);
        pending(idOf(uniqueEmailSignedUp()));

        JsonNode page = read(getAs(me, "/api/orders").andExpect(status().isOk()));

        assertThat(page.get("content")).hasSize(2);
        assertThat(page.get("content").get(0).get("id").asText()).isEqualTo(second.id());
        assertThat(page.get("content").get(1).get("id").asText()).isEqualTo(first.id());
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.get("totalElements").asInt()).isEqualTo(2);
        assertThat(page.get("totalPages").asInt()).isEqualTo(1);
        JsonNode row = page.get("content").get(0);
        assertThat(row.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("id", "placedAt", "status", "kind", "summary", "totalAmount");
        assertThat(row.get("totalAmount").decimalValue()).isEqualByComparingTo("25.00");
    }

    private String uniqueEmailSignedUp() {
        String email = uniqueEmail("other");
        provision(email, Rol.CLIENTE);
        return email;
    }

    @Test
    void customerListSupportsStatusKindSortAndPaging() throws Exception {
        String email = uniqueEmail("filters");
        Cookie me = signIn(email);
        Long myId = idOf(email);
        Order a = orderAt(myId, OrderStatus.ENVIADO);
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        Order b = orderAt(myId, OrderStatus.CONFIRMADO);
        ((MutableClock) clock).advance(Duration.ofMinutes(1));
        Order c = orderAt(myId, OrderStatus.CONFIRMADO);

        assertThat(ids(read(getAs(me, "/api/orders?status=CONFIRMADO")))).containsExactly(c.id(), b.id());
        assertThat(ids(read(getAs(me, "/api/orders?kind=ESTANDAR&sort=placedAt,asc")))).containsExactly(a.id(), b.id(), c.id());
        assertThat(ids(read(getAs(me, "/api/orders?kind=PERSONALIZADO")))).isEmpty();
        JsonNode second = read(getAs(me, "/api/orders?size=2&page=1&sort=placedAt,desc"));
        assertThat(ids(second)).containsExactly(a.id());
        assertThat(second.get("totalElements").asInt()).isEqualTo(3);
        assertThat(second.get("totalPages").asInt()).isEqualTo(2);
    }

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("content").forEach(n -> ids.add(n.get("id").asText()));
        return ids;
    }

    @Test
    void customerListRejectsBadPagingSortAndFilterValues() throws Exception {
        Cookie me = signIn(uniqueEmail("bad"));
        for (String q : List.of("size=101", "size=0", "page=-1")) {
            getAs(me, "/api/orders?" + q).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String q : List.of("sort=total", "sort=placedAt,sideways", "sort=placedAt,asc,x", "status=NOPE", "status=PENDIENTE", "kind=NOPE", "size=abc")) {
            getAs(me, "/api/orders?" + q).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
        getAs(me, "/api/orders?size=100").andExpect(status().isOk());
    }

    @Test
    void aForgedCustomerIdParameterNeverWidensTheList() throws Exception {
        String email = uniqueEmail("forge");
        Cookie me = signIn(email);
        Order other = pending(idOf(uniqueEmailSignedUp()));
        JsonNode page = read(getAs(me, "/api/orders?customerId=" + other.customerId() + "&q=" + other.id()).andExpect(status().isOk()));
        assertThat(page.get("content")).isEmpty();
    }

    // ---------- customer: detail / tracking ----------

    @Test
    void customerDetailShowsTheOrderWithItsHistoryAndNoStaffIdentity() throws Exception {
        String email = uniqueEmail("detail");
        Cookie me = signIn(email);
        Order o = pending(idOf(email));
        String staffEmail = uniqueEmail("asesor");
        Cookie advisor = staff(Rol.ASESOR, staffEmail);
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION", "note", "Pago verificado")).andExpect(status().isOk());

        String body = getAs(me, "/api/orders/" + o.id()).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(o.id()))
                .andExpect(jsonPath("$.status").value("EN_PRODUCCION"))
                .andExpect(jsonPath("$.statusHistory.length()").value(2))
                .andExpect(jsonPath("$.statusHistory[0].previousStatus").doesNotExist())
                .andExpect(jsonPath("$.statusHistory[0].newStatus").value("CONFIRMADO"))
                .andExpect(jsonPath("$.statusHistory[0].responsible").value("Sistema"))
                .andExpect(jsonPath("$.statusHistory[1].previousStatus").value("CONFIRMADO"))
                .andExpect(jsonPath("$.statusHistory[1].newStatus").value("EN_PRODUCCION"))
                .andExpect(jsonPath("$.statusHistory[1].responsible").value("Equipo Ar Makers 3D"))
                .andExpect(jsonPath("$.statusHistory[1].note").value("Pago verificado"))
                .andExpect(jsonPath("$.allowedNextStatuses").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(staffEmail);
    }

    @Test
    void anotherCustomersOrderAndAnUnknownIdAreTheSame404() throws Exception {
        Cookie me = signIn(uniqueEmail("snoop"));
        Order theirs = pending(idOf(uniqueEmailSignedUp()));

        var notOwned = getAs(me, "/api/orders/" + theirs.id()).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND")).andReturn().getResponse();
        var unknown = getAs(me, "/api/orders/PED-999999").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND")).andReturn().getResponse();
        var malformed = getAs(me, "/api/orders/not-an-order").andExpect(status().isNotFound()).andReturn().getResponse();

        JsonNode a = objectMapper.readTree(notOwned.getContentAsString());
        JsonNode b = objectMapper.readTree(unknown.getContentAsString());
        JsonNode c = objectMapper.readTree(malformed.getContentAsString());
        assertThat(a.get("code")).isEqualTo(b.get("code"));
        assertThat(a.get("message")).isEqualTo(b.get("message"));
        assertThat(a.get("message")).isEqualTo(c.get("message"));
        assertThat(notOwned.getContentAsString()).doesNotContain(theirs.id());
    }

    @Test
    void thereIsNoPublicTrackingEndpoint() throws Exception {
        Order o = pending(idOf(uniqueEmailSignedUp()));
        getAs(null, "/api/orders/" + o.id()).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        getAs(null, "/api/orders").andExpect(status().isUnauthorized());
        getAs(null, "/api/orders/" + o.id() + "/tracking").andExpect(status().isUnauthorized());
    }

    @Test
    void staffCannotUseTheCustomerOrderEndpoints() throws Exception {
        Order o = pending(idOf(uniqueEmailSignedUp()));
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie c = signInAs(rol);
            getAs(c, "/api/orders").andExpect(status().isForbidden());
            getAs(c, "/api/orders/" + o.id()).andExpect(status().isForbidden());
        }
    }

    // ---------- customer cannot change status / staff-only ----------

    @Test
    void customerCannotChangeStatusOrReadStaffEndpoints() throws Exception {
        String email = uniqueEmail("nope");
        Cookie me = signIn(email);
        Order mine = pending(idOf(email));

        changeStatus(me, mine.id(), Map.of("status", "CANCELADO")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        changeStatus(me, "PED-999999", Map.of("status", "CANCELADO")).andExpect(status().isForbidden());
        getAs(me, "/api/admin/orders").andExpect(status().isForbidden());
        getAs(me, "/api/admin/orders/" + mine.id()).andExpect(status().isForbidden());
        assertThat(orders.findById(mine.id()).orElseThrow().status()).isEqualTo(OrderStatus.CONFIRMADO);
        assertThat(orders.findById(mine.id()).orElseThrow().history()).hasSize(1);
    }

    @Test
    void anonymousGets401OnEveryStaffOrderEndpoint() throws Exception {
        getAs(null, "/api/admin/orders").andExpect(status().isUnauthorized());
        getAs(null, "/api/admin/orders/PED-000001").andExpect(status().isUnauthorized());
        changeStatus(null, "PED-000001", Map.of("status", "CONFIRMADO")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // ---------- staff: list / detail ----------

    @Test
    void staffListFiltersByTextStatusKindAndDates() throws Exception {
        for (Rol rol : List.of(Rol.ASESOR, Rol.ADMINISTRADOR)) {
            Cookie s = signInAs(rol);
            String email = uniqueEmail("buyer");
            provision(email, Rol.CLIENTE);
            Long id = idOf(email);
            Order a = orderAt(id, OrderStatus.CONFIRMADO);
            Order b = orderAt(id, OrderStatus.EN_PRODUCCION);
            String fragment = email.substring(0, email.indexOf('@'));

            // q by customer email fragment (case-insensitive) and by order id
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment.toUpperCase()).andExpect(status().isOk()))))
                    .containsExactlyInAnyOrder(a.id(), b.id());
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + a.id().toLowerCase())))).containsExactly(a.id());
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment + "&status=EN_PRODUCCION")))).containsExactly(b.id());
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment + "&kind=PERSONALIZADO")))).isEmpty();

            String today = clock.instant().atZone(LIMA).toLocalDate().toString();
            String yesterday = clock.instant().atZone(LIMA).toLocalDate().minusDays(1).toString();
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment + "&from=" + today + "&to=" + today))))
                    .containsExactlyInAnyOrder(a.id(), b.id());
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment + "&to=" + yesterday)))).isEmpty();
            assertThat(ids(read(getAs(s, "/api/admin/orders?q=" + fragment + "&from=2999-01-01")))).isEmpty();

            JsonNode row = read(getAs(s, "/api/admin/orders?q=" + a.id())).get("content").get(0);
            assertThat(row.get("customerEmail").asText()).isEqualTo(email);
            assertThat(row.has("customerName")).isTrue();
            assertThat(row.has("customerPhone")).isTrue();
            assertThat(row.has("allowedNextStatuses")).isFalse();
        }
    }

    @Test
    void staffListRejectsInvalidParameters() throws Exception {
        Cookie s = signInAs(Rol.ASESOR);
        for (String q : List.of("size=101", "size=0", "page=-1", "q=" + "x".repeat(101))) {
            getAs(s, "/api/admin/orders?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
        for (String q : List.of("sort=customerEmail", "sort=placedAt,up", "status=NOPE", "status=PENDIENTE", "kind=NOPE", "from=06-10-2026",
                "to=2026-13-40", "from=yesterday")) {
            getAs(s, "/api/admin/orders?" + q).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
        getAs(s, "/api/admin/orders?from=2026-10-07&to=2026-10-06").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        getAs(s, "/api/admin/orders?size=100&sort=placedAt,asc").andExpect(status().isOk());
    }

    @Test
    void staffDetailIncludesHistoryWithStaffEmailsAndAllowedNextStatuses() throws Exception {
        String advisorEmail = uniqueEmail("asesor");
        Cookie advisor = staff(Rol.ASESOR, advisorEmail);
        String customerEmail = uniqueEmail("cust");
        provision(customerEmail, Rol.CLIENTE);
        Order o = pending(idOf(customerEmail));
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION")).andExpect(status().isOk());

        getAs(advisor, "/api/admin/orders/" + o.id()).andExpect(status().isOk())
                .andExpect(jsonPath("$.customerEmail").value(customerEmail))
                .andExpect(jsonPath("$.status").value("EN_PRODUCCION"))
                .andExpect(jsonPath("$.allowedNextStatuses[0]").value("ENVIADO"))
                .andExpect(jsonPath("$.allowedNextStatuses[1]").value("CANCELADO"))
                .andExpect(jsonPath("$.statusHistory[0].responsible").value("Sistema"))
                .andExpect(jsonPath("$.statusHistory[1].responsible").value(advisorEmail))
                .andExpect(jsonPath("$.agreedAmount").doesNotExist());
        getAs(advisor, "/api/admin/orders/PED-999999").andExpect(status().isNotFound());
    }

    // ---------- staff: status change ----------

    static Stream<Arguments> everyPair() {
        List<Arguments> args = new ArrayList<>();
        for (OrderStatus from : OrderStatus.values()) {
            for (OrderStatus to : OrderStatus.values()) {
                args.add(Arguments.of(from, to, from.allowedNext().contains(to)));
            }
        }
        return args.stream();
    }

    @ParameterizedTest(name = "{0} -> {1}: allowed={2}")
    @MethodSource("everyPair")
    void theBackendEnforcesEveryTransitionPairOverHttp(OrderStatus from, OrderStatus to, boolean allowed) throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        Order o = orderAt(idOf(uniqueEmailSignedUp()), from);

        if (allowed) {
            changeStatus(advisor, o.id(), Map.of("status", to.name())).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(to.name()));
            assertThat(orders.findById(o.id()).orElseThrow().history()).hasSize(o.history().size() + 1);
        } else {
            changeStatus(advisor, o.id(), Map.of("status", to.name())).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"))
                    .andExpect(jsonPath("$.fieldErrors").doesNotExist());
            assertThat(orders.findById(o.id()).orElseThrow()).isEqualTo(o);
        }
    }

    @Test
    void advisorAndAdministratorBothMayChangeStatusAndTheActorIsThePrincipal() throws Exception {
        String advisorEmail = uniqueEmail("asesor");
        String adminEmail = uniqueEmail("admin");
        Cookie advisor = staff(Rol.ASESOR, advisorEmail);
        Cookie admin = staff(Rol.ADMINISTRADOR, adminEmail);
        Order o = pending(idOf(uniqueEmailSignedUp()));
        Long advisorId = idOf(advisorEmail);
        Long adminId = idOf(adminEmail);

        var before = clock.instant();
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION")).andExpect(status().isOk());
        ((MutableClock) clock).advance(Duration.ofMinutes(5));
        changeStatus(admin, o.id(), Map.of("status", "ENVIADO", "note", "  En la impresora 2  ")).andExpect(status().isOk());

        Order stored = orders.findById(o.id()).orElseThrow();
        assertThat(stored.history()).hasSize(3);
        var h1 = stored.history().get(1);
        var h2 = stored.history().get(2);
        assertThat(h1.actorId()).isEqualTo(advisorId);
        assertThat(h1.actorRole()).isEqualTo(Rol.ASESOR);
        assertThat(h1.at()).isEqualTo(before);
        assertThat(h2.actorId()).isEqualTo(adminId);
        assertThat(h2.actorRole()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(h2.at()).isEqualTo(before.plus(Duration.ofMinutes(5)));
        assertThat(h2.note()).isEqualTo("En la impresora 2");
        assertThat(h2.fromStatus()).isEqualTo(OrderStatus.EN_PRODUCCION);
    }

    @Test
    void forgedBodyFieldsAreIgnored() throws Exception {
        String advisorEmail = uniqueEmail("asesor");
        Cookie advisor = staff(Rol.ASESOR, advisorEmail);
        Order o = pending(idOf(uniqueEmailSignedUp()));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "EN_PRODUCCION");
        body.put("actorId", 1);
        body.put("actorRole", "ADMINISTRADOR");
        body.put("responsible", "Alguien Mas");
        body.put("changedAt", "2000-01-01T00:00:00Z");
        body.put("previousStatus", "ENTREGADO");
        body.put("customerId", 12345);
        body.put("id", "PED-000000");

        changeStatus(advisor, o.id(), body).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(o.id()))
                .andExpect(jsonPath("$.statusHistory[1].responsible").value(advisorEmail))
                .andExpect(jsonPath("$.statusHistory[1].previousStatus").value("CONFIRMADO"));
        Order stored = orders.findById(o.id()).orElseThrow();
        assertThat(stored.history().get(1).actorId()).isEqualTo(idOf(advisorEmail));
        assertThat(stored.history().get(1).actorRole()).isEqualTo(Rol.ASESOR);
        assertThat(stored.history().get(1).at()).isEqualTo(clock.instant());
        assertThat(stored.customerId()).isEqualTo(o.customerId());
    }

    @Test
    void resendingTheCurrentStatusIsRejectedAndNeverDuplicatesHistory() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        Order o = pending(idOf(uniqueEmailSignedUp()));
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION")).andExpect(status().isOk());
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
        assertThat(orders.findById(o.id()).orElseThrow().history()).hasSize(2);
    }

    @Test
    void statusChangeValidatesTheBodyAndTheOrderId() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        Order o = pending(idOf(uniqueEmailSignedUp()));

        changeStatus(advisor, o.id(), Map.of()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("status"));
        changeStatus(advisor, o.id(), Map.of("status", "ENVIADO_YA")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        changeStatus(advisor, o.id(), Map.of("status", "confirmado")).andExpect(status().isBadRequest());
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION", "note", "n".repeat(501))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("note"));
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION", "note", "bad\u0000note")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(patch("/api/admin/orders/" + o.id() + "/status").cookie(advisor)
                        .contentType(MediaType.TEXT_PLAIN).content("EN_PRODUCCION"))
                .andExpect(status().isUnsupportedMediaType());
        changeStatus(advisor, "PED-999999", Map.of("status", "EN_PRODUCCION")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(orders.findById(o.id()).orElseThrow().status()).isEqualTo(OrderStatus.CONFIRMADO);

        // A 500 character note and a blank note are accepted; blank is stored as null.
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION", "note", "   ")).andExpect(status().isOk())
                .andExpect(jsonPath("$.statusHistory[1].note").doesNotExist());
    }

    @Test
    void concurrentConflictingChangesLetExactlyOneWin() throws Exception {
        Long staffId = provision(uniqueEmail("asesor"), Rol.ASESOR).getId();
        Order o = orderAt(idOf(uniqueEmailSignedUp()), OrderStatus.EN_PRODUCCION);
        int threads = 12;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            OrderStatus target = i % 2 == 0 ? OrderStatus.ENVIADO : OrderStatus.CANCELADO;
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                try {
                    statusService.changeStatus(
                            new OrderStatusService.ChangeStatusCommand(o.id(), target, null, staffId, Rol.ASESOR));
                    return true;
                } catch (InvalidStatusTransitionException ex) {
                    return false;
                }
            }));
        }
        ready.await();
        go.countDown();
        int winners = 0;
        for (Future<Boolean> f : futures) {
            if (f.get()) {
                winners++;
            }
        }
        pool.shutdown();

        // ENVIADO and CANCELADO both leave EN_PRODUCCION and neither can follow the other
        // (ENVIADO -> CANCELADO is not allowed, CANCELADO is terminal), so exactly one change may be applied.
        assertThat(winners).isEqualTo(1);
        Order stored = orders.findById(o.id()).orElseThrow();
        assertThat(stored.history()).hasSize(o.history().size() + 1);
        assertThat(stored.status()).isIn(OrderStatus.ENVIADO, OrderStatus.CANCELADO);
        assertThat(stored.history().get(stored.history().size() - 1).toStatus()).isEqualTo(stored.status());
    }

    @Test
    void concurrentIdenticalChangesAreAppliedOnlyOnce() throws Exception {
        Long staffId = provision(uniqueEmail("asesor"), Rol.ASESOR).getId();
        Order o = pending(idOf(uniqueEmailSignedUp()));
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                go.await();
                try {
                    statusService.changeStatus(new OrderStatusService.ChangeStatusCommand(
                            o.id(), OrderStatus.EN_PRODUCCION, null, staffId, Rol.ASESOR));
                    return true;
                } catch (InvalidStatusTransitionException ex) {
                    return false;
                }
            }));
        }
        go.countDown();
        int winners = 0;
        for (Future<Boolean> f : futures) {
            winners += f.get() ? 1 : 0;
        }
        pool.shutdown();
        assertThat(winners).isEqualTo(1);
        assertThat(orders.findById(o.id()).orElseThrow().history()).hasSize(2);
    }

    // ---------- history at creation (both flows) ----------

    private long firstCatalogProductId() throws Exception {
        return read(getAs(null, "/api/catalog/products?size=1")).get("content").get(0).get("id").asLong();
    }

    @Test
    void standardOrderCreatedThroughTheApiHasItsInitialHistoryEntry() throws Exception {
        String email = uniqueEmail("buyer");
        Cookie me = signIn(email);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", List.of(Map.of("productId", firstCatalogProductId(), "quantity", 1)));
        body.put("delivery", Map.of("address", "Av. Siempre Viva 123", "district", "Miraflores"));
        body.put("contact", Map.of("fullName", "Ana Perez", "phone", "+51 999 888 777"));
        JsonNode created = read(mockMvc.perform(post("/api/orders").cookie(me).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.statusHistory.length()").value(1))
                .andExpect(jsonPath("$.statusHistory[0].newStatus").value("CONFIRMADO"))
                .andExpect(jsonPath("$.statusHistory[0].previousStatus").doesNotExist())
                .andExpect(jsonPath("$.statusHistory[0].responsible").value("Sistema")));

        var entry = orders.findById(created.get("id").asText()).orElseThrow().history().get(0);
        assertThat(entry.actorId()).isEqualTo(idOf(email));
        assertThat(entry.actorRole()).isEqualTo(Rol.CLIENTE);
        assertThat(entry.at()).isEqualTo(clock.instant());
        getAs(me, "/api/orders/" + created.get("id").asText()).andExpect(status().isOk())
                .andExpect(jsonPath("$.statusHistory.length()").value(1));
    }

    @Test
    void personalizedOrderRegisteredThroughTheApiHasItsInitialHistoryEntryByTheStaffActor() throws Exception {
        String advisorEmail = uniqueEmail("asesor");
        Cookie advisor = staff(Rol.ASESOR, advisorEmail);
        String customerEmail = uniqueEmail("cust");
        provision(customerEmail, Rol.CLIENTE);
        Cookie customer = signIn(customerEmail);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customerEmail", customerEmail);
        body.put("description", "Figura articulada personalizada 15 cm");
        body.put("agreedAmount", new BigDecimal("150.50"));
        body.put("paymentConfirmed", true);

        JsonNode created = read(mockMvc.perform(post("/api/admin/orders/personalized").cookie(advisor)
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.statusHistory.length()").value(1))
                .andExpect(jsonPath("$.statusHistory[0].newStatus").value("CONFIRMADO"))
                .andExpect(jsonPath("$.statusHistory[0].previousStatus").doesNotExist())
                .andExpect(jsonPath("$.statusHistory[0].responsible").value(advisorEmail))
                .andExpect(jsonPath("$.allowedNextStatuses[0]").value("EN_PRODUCCION")));
        String id = created.get("id").asText();

        var entry = orders.findById(id).orElseThrow().history().get(0);
        assertThat(entry.actorId()).isEqualTo(idOf(advisorEmail));
        assertThat(entry.actorRole()).isEqualTo(Rol.ASESOR);
        // The customer sees it too, without the staff identity.
        String customerView = getAs(customer, "/api/orders/" + id).andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("PERSONALIZADO"))
                .andExpect(jsonPath("$.statusHistory[0].responsible").value("Equipo Ar Makers 3D"))
                .andReturn().getResponse().getContentAsString();
        assertThat(customerView).doesNotContain(advisorEmail);
    }

    // ---------- notification hook and audit ----------

    @Test
    void everySuccessfulChangePublishesOneEventAndRejectedOnesPublishNone() throws Exception {
        Cookie advisor = signInAs(Rol.ASESOR);
        Order o = pending(idOf(uniqueEmailSignedUp()));
        long before = events.stream(OrderStatusChanged.class).count();

        changeStatus(advisor, o.id(), Map.of("status", "ENTREGADO")).andExpect(status().isConflict());
        assertThat(events.stream(OrderStatusChanged.class).count()).isEqualTo(before);

        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION")).andExpect(status().isOk());
        List<OrderStatusChanged> published = events.stream(OrderStatusChanged.class)
                .filter(e -> e.orderId().equals(o.id())).toList();
        assertThat(published).hasSize(1);
        var e = published.get(0);
        assertThat(e.previousStatus()).isEqualTo(OrderStatus.CONFIRMADO);
        assertThat(e.newStatus()).isEqualTo(OrderStatus.EN_PRODUCCION);
        assertThat(e.customerId()).isEqualTo(o.customerId());
        assertThat(e.actorRole()).isEqualTo(Rol.ASESOR);
    }

    @Test
    void creationPublishesAnEventWithNoPreviousStatus() throws Exception {
        String email = uniqueEmail("buyer");
        Cookie me = signIn(email);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", List.of(Map.of("productId", firstCatalogProductId(), "quantity", 1)));
        body.put("delivery", Map.of("address", "Av. Siempre Viva 123", "district", "Miraflores"));
        body.put("contact", Map.of("fullName", "Ana Perez", "phone", "+51 999 888 777"));
        String id = read(mockMvc.perform(post("/api/orders").cookie(me).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isCreated())).get("id").asText();
        assertThat(events.stream(OrderStatusChanged.class).filter(e -> e.orderId().equals(id)))
                .singleElement()
                .satisfies(e -> {
                    assertThat(e.previousStatus()).isNull();
                    assertThat(e.newStatus()).isEqualTo(OrderStatus.CONFIRMADO);
                });
    }

    @Test
    void statusChangesAreAuditedWithIdsOnlyAndNeverLogTheNote() throws Exception {
        String advisorEmail = uniqueEmail("asesor");
        Cookie advisor = staff(Rol.ASESOR, advisorEmail);
        Order o = pending(idOf(uniqueEmailSignedUp()));
        changeStatus(advisor, o.id(), Map.of("status", "EN_PRODUCCION", "note", "texto-secreto-del-asesor")).andExpect(status().isOk());
        changeStatus(advisor, o.id(), Map.of("status", "ENTREGADO")).andExpect(status().isConflict());

        List<String> lines = auditLogs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
        assertThat(lines).anyMatch(l -> l.startsWith("order.status.changed")
                && l.contains("order=" + o.id()) && l.contains("from=CONFIRMADO") && l.contains("to=EN_PRODUCCION")
                && l.contains("actor=" + idOf(advisorEmail)) && l.contains("role=ASESOR"));
        assertThat(lines).anyMatch(l -> l.startsWith("order.status.rejected") && l.contains("to=ENTREGADO"));
        assertThat(lines).noneMatch(l -> l.contains("texto-secreto") || l.contains(advisorEmail));
    }

    @ParameterizedTest
    @EnumSource(value = Rol.class, names = {"ASESOR", "ADMINISTRADOR"})
    void staffRolesCanReadTheDetailOfAnyOrder(Rol rol) throws Exception {
        Order o = pending(idOf(uniqueEmailSignedUp()));
        getAs(signInAs(rol), "/api/admin/orders/" + o.id()).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(o.id()));
    }
}
