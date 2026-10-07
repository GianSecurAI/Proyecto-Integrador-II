package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.orders.domain.Order;
import com.armakers3d.orders.domain.OrderStatus;
import com.armakers3d.testsupport.CapturingEmailSender.SentEmail;
import com.armakers3d.testsupport.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * Administrator verification over HTTP (ADR-005): the queue, the detail, approval (exactly one order, idempotent,
 * race-safe, admin as history actor, CONFIRMADO email) and rejection (reason required, customer email, state
 * conflicts), plus role and object-level access and the "no expiry once a proof exists" rule.
 */
class PaymentVerificationApiTest extends AbstractCheckoutApiTest {

    private List<SentEmail> emailsTo(String email) {
        return emailSender.getSent().stream().filter(e -> e.to().equalsIgnoreCase(email)).toList();
    }

    // ---------- queue and detail ----------

    @Test
    void theQueueListsSubmittedProofsOldestFirstAndPaginates() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("queue"));
        String first = checkoutWithProof(customer, p, 1, 11);
        ((MutableClock) clock).advance(Duration.ofMinutes(5));
        String second = checkoutWithProof(customer, p, 1, 12);
        ((MutableClock) clock).advance(Duration.ofMinutes(5));
        String third = checkoutWithProof(customer, p, 1, 13);
        Cookie freshAdmin = signInAs(Rol.ADMINISTRADOR); // the clock moved: sessions of the same day still valid, this is just explicit

        MvcResultJson all = new MvcResultJson(mockMvc.perform(get("/api/admin/payments?size=100").cookie(freshAdmin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(0)).andReturn().getResponse().getContentAsString());
        List<String> ids = all.ids();
        assertThat(ids.indexOf(first)).isLessThan(ids.indexOf(second));
        assertThat(ids.indexOf(second)).isLessThan(ids.indexOf(third));

        mockMvc.perform(get("/api/admin/payments?size=1&page=0").cookie(freshAdmin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.size").value(1));
        mockMvc.perform(get("/api/admin/payments?size=0").cookie(freshAdmin)).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/payments?size=101").cookie(freshAdmin)).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/payments?status=BOGUS").cookie(freshAdmin)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void theQueueFiltersByStatusAndApprovedOnesLeaveTheDefaultQueue() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("filter"));
        String pending = checkoutWithProof(customer, p, 1, 21);
        String approved = checkoutWithProof(customer, p, 1, 22);
        String awaiting = startCheckout(customer, p, 1);
        approve(approved).andExpect(status().isOk());

        List<String> defaults = new MvcResultJson(adminGet("/api/admin/payments?size=100").andReturn().getResponse().getContentAsString()).ids();
        assertThat(defaults).contains(pending).doesNotContain(approved, awaiting);
        List<String> paid = new MvcResultJson(adminGet("/api/admin/payments?status=PAID&size=100").andReturn().getResponse().getContentAsString()).ids();
        assertThat(paid).contains(approved).doesNotContain(pending);
        List<String> waiting = new MvcResultJson(adminGet("/api/admin/payments?status=AWAITING_PAYMENT_PROOF&size=100").andReturn().getResponse().getContentAsString()).ids();
        assertThat(waiting).contains(awaiting);
        adminGet("/api/admin/payments?status=PAID&size=100").andExpect(jsonPath("$.content[?(@.checkoutId=='" + approved + "')].status").value("PAID"));
    }

    @Test
    void theDetailShowsWhatTheAdministratorNeedsAndNothingInternal() throws Exception {
        long p1 = createProduct("21.90");
        long p2 = createProduct("14.50");
        Cookie customer = signIn(uniqueEmail("detail"));
        String id = read(submit(customer, checkoutBody(item(p1, 2), item(p2, 3))).andExpect(status().isCreated())).get("checkoutId").asText();
        uploadOk(customer, id, png(64, 64, 31));

        String raw = adminGet("/api/admin/payments/" + id).andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutId").value(id))
                .andExpect(jsonPath("$.reference").value("AM3D-" + id.substring(0, 8).toUpperCase()))
                .andExpect(jsonPath("$.status").value("PROOF_SUBMITTED"))
                .andExpect(jsonPath("$.totalAmount").value(87.3))
                .andExpect(jsonPath("$.currency").value("PEN"))
                .andExpect(jsonPath("$.contact.fullName").value("Ana Perez"))
                .andExpect(jsonPath("$.contact.phone").value("+51 999 888 777"))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.attempts.length()").value(1))
                .andExpect(jsonPath("$.attempts[0].method").value("YAPE"))
                .andExpect(jsonPath("$.attempts[0].contentType").value("image/png"))
                .andExpect(jsonPath("$.attempts[0].decision").value("PENDING"))
                .andExpect(jsonPath("$.duplicateProofWarning").value(false))
                .andReturn().getResponse().getContentAsString();
        assertThat(raw).doesNotContain("storageKey").doesNotContain("sha256").doesNotContain("\"hash\"");
        adminGet("/api/admin/payments/not-a-uuid").andExpect(status().isNotFound());
        adminGet("/api/admin/payments/" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void theAdministratorViewsTheProofWithTheHardenedHeaders() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("adminview"));
        String id = startCheckout(customer, p, 1);
        byte[] image = jpeg(70, 70, 41);
        String attemptId = read(upload(customer, id, image).andExpect(status().isOk())).get("attempts").get(0).get("attemptId").asText();

        adminGet("/api/admin/payments/" + id + "/proof/" + attemptId).andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"payment-proof.jpg\""))
                .andExpect(content().bytes(image));
        adminGet("/api/admin/payments/" + id + "/proof/" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    // ---------- approval ----------

    @Test
    void approvingCreatesExactlyOneConfirmedOrderWithTheAdministratorAsActorAndEmailsTheCustomer() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("approve");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 3, 51);
        changePrice(p, "99.00"); // later catalog changes do not alter the snapshot
        assertThat(orderRepository.findByCheckoutId(id)).isEmpty(); // no order before the approval
        Cookie adminCookie = admin();
        Long adminId = idOfCookie(adminCookie);
        emailSender.clear();

        JsonNode body = read(approve(id).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.orderId").value(org.hamcrest.Matchers.matchesPattern("PED-\\d{6}")))
                .andExpect(jsonPath("$.attempts[0].decision").value("APPROVED"))
                .andExpect(jsonPath("$.attempts[0].decidedBy").value(adminId.intValue())));
        assertThat(body.get("totalAmount").decimalValue()).isEqualByComparingTo("60.00");

        Order order = orderRepository.findByCheckoutId(id).orElseThrow();
        assertThat(order.id()).isEqualTo(body.get("orderId").asText());
        assertThat(order.status()).isEqualTo(OrderStatus.CONFIRMADO);
        assertThat(order.customerId()).isEqualTo(idOf(email));
        assertThat(order.paymentReference()).isEqualTo("AM3D-" + id.substring(0, 8).toUpperCase());
        assertThat(order.history()).hasSize(1);
        assertThat(order.history().get(0).actorId()).isEqualTo(adminId);
        assertThat(order.history().get(0).actorRole()).isEqualTo(Rol.ADMINISTRADOR);
        assertThat(order.lines().get(0).unitPrice()).isEqualByComparingTo("20.00");
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);

        // one CONFIRMADO email, to the customer, mentioning the order code
        List<SentEmail> mails = emailsTo(email);
        assertThat(mails).hasSize(1);
        assertThat(mails.get(0).subject()).contains(order.id()).contains("Confirmado");

        // the customer now sees the order id and PAID
        poll(customer, id).andExpect(jsonPath("$.status").value("PAID")).andExpect(jsonPath("$.orderId").value(order.id()))
                .andExpect(jsonPath("$.proofStatus").value("APPROVED"));
        mockMvc.perform(get("/api/orders/" + order.id()).cookie(customer)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"));
    }

    @Test
    void approvingTwiceIsIdempotentAndCreatesNothingNew() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("twice");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 61);
        emailSender.clear();

        JsonNode first = read(approve(id).andExpect(status().isOk()));
        JsonNode second = read(approve(id).andExpect(status().isOk()));
        assertThat(second.get("orderId").asText()).isEqualTo(first.get("orderId").asText());
        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
        assertThat(emailsTo(email)).hasSize(1);
    }

    @Test
    void concurrentApprovalsProduceOneOrderAndOneEmail() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("concurrent");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 71);
        Cookie adminCookie = admin();
        emailSender.clear();

        ExecutorService pool = Executors.newFixedThreadPool(8);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            Callable<Integer> task = () -> mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(adminCookie))
                    .andReturn().getResponse().getStatus();
            results.add(pool.submit(task));
        }
        for (Future<Integer> f : results) {
            assertThat(f.get()).isEqualTo(200);
        }
        pool.shutdown();

        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1);
        assertThat(emailsTo(email)).hasSize(1);
        poll(customer, id).andExpect(jsonPath("$.orderId").value(orderRepository.findByCheckoutId(id).orElseThrow().id()));
    }

    @Test
    void approvingOrRejectingInTheWrongStateIsAConflictAndCreatesNothing() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("wrong");
        Cookie customer = signIn(email);

        String awaiting = startCheckout(customer, p, 1);
        approve(awaiting).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKOUT_STATE_CONFLICT"));
        reject(awaiting, "x").andExpect(status().isConflict());

        String rejected = checkoutWithProof(customer, p, 1, 81);
        reject(rejected, "Borroso").andExpect(status().isOk());
        approve(rejected).andExpect(status().isConflict());
        reject(rejected, "Otra vez").andExpect(status().isConflict()); // double reject

        String cancelled = checkoutWithProof(customer, p, 1, 82);
        cancel(customer, cancelled).andExpect(status().isOk());
        approve(cancelled).andExpect(status().isConflict());
        reject(cancelled, "x").andExpect(status().isConflict());

        String paid = checkoutWithProof(customer, p, 1, 83);
        approve(paid).andExpect(status().isOk());
        reject(paid, "tarde").andExpect(status().isConflict());

        assertThat(orderRepository.findByCustomerId(idOf(email))).hasSize(1); // only the PAID one

        approve(UUID.randomUUID().toString()).andExpect(status().isNotFound());
        approve("not-a-uuid").andExpect(status().isNotFound());
        reject(UUID.randomUUID().toString(), "x").andExpect(status().isNotFound());
    }

    @Test
    void anExpiredCheckoutCannotBeApproved() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("expired");
        Cookie customer = signIn(email);
        String id = startCheckout(customer, p, 1);
        ((MutableClock) clock).advance(Duration.ofHours(25));
        assertThat(expiryService.expireStale()).isGreaterThanOrEqualTo(1);
        Cookie freshAdmin = signInAs(Rol.ADMINISTRADOR);

        mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(freshAdmin)).andExpect(status().isConflict());
        mockMvc.perform(get("/api/admin/payments/" + id).cookie(freshAdmin)).andExpect(jsonPath("$.status").value("EXPIRED"));
        assertThat(orderRepository.findByCheckoutId(id)).isEmpty();
    }

    @Test
    void aCheckoutWithASubmittedProofNeverExpiresAndCanStillBeApprovedMuchLater() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("later");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 91);

        ((MutableClock) clock).advance(Duration.ofDays(40));
        expiryService.expireStale();
        Cookie freshAdmin = signInAs(Rol.ADMINISTRADOR);

        mockMvc.perform(get("/api/admin/payments/" + id).cookie(freshAdmin)).andExpect(jsonPath("$.status").value("PROOF_SUBMITTED"));
        mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(freshAdmin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));
        assertThat(orderRepository.findByCheckoutId(id)).isPresent();
    }

    // ---------- rejection ----------

    @Test
    void rejectingRequiresAReasonOfAtMost300CharactersWithoutControlCharacters() throws Exception {
        long p = createProduct("20.00");
        Cookie customer = signIn(uniqueEmail("reasons"));
        String id = checkoutWithProof(customer, p, 1, 101);
        for (String bad : new String[] {"", "   ", "x".repeat(301), "linea1\nlinea2", "tab\tchar"}) {
            reject(id, bad).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("reason"));
        }
        mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(admin()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("reason"));
        mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(admin())).andExpect(status().is4xxClientError()); // no body at all
        poll(customer, id).andExpect(jsonPath("$.status").value("PROOF_SUBMITTED")); // nothing changed
        reject(id, "x".repeat(300)).andExpect(status().isOk());
    }

    @Test
    void rejectingRecordsTheReasonTheAdministratorAndEmailsTheCustomerOnce() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("rejected");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 111);
        Long adminId = idOfCookie(admin());
        emailSender.clear();

        // the body tries to forge the actor; it is ignored (unknown property), the principal is the actor
        mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"El monto no coincide <b>con Yape</b>\",\"decidedBy\":999999,\"status\":\"PAID\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROOF_REJECTED"))
                .andExpect(jsonPath("$.attempts[0].decision").value("REJECTED"))
                .andExpect(jsonPath("$.attempts[0].decidedBy").value(adminId.intValue()))
                .andExpect(jsonPath("$.attempts[0].rejectionReason").value("El monto no coincide <b>con Yape</b>"));
        assertThat(orderRepository.findByCheckoutId(id)).isEmpty();

        List<SentEmail> mails = emailsTo(email);
        assertThat(mails).hasSize(1);
        SentEmail mail = mails.get(0);
        assertThat(mail.subject()).contains("comprobante");
        assertThat(mail.body()).contains("El monto no coincide").contains("con Yape")
                .contains("http://localhost:4200/checkout/confirmacion?checkoutId=" + id)
                .doesNotContain("<").doesNotContain(">").doesNotContain("87.3");
    }

    @Test
    void anEmailFailureNeverBreaksTheRejection() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("mailfail");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 121);
        emailSender.setFailing(true);
        try {
            reject(id, "Imagen borrosa").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PROOF_REJECTED"));
        } finally {
            emailSender.setFailing(false);
        }
        poll(customer, id).andExpect(jsonPath("$.status").value("PROOF_REJECTED")).andExpect(jsonPath("$.rejectionReason").value("Imagen borrosa"));
    }

    @Test
    void concurrentRejectionsOfTheSameProofSucceedOnceAndEmailOnce() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("rejrace");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 131);
        Cookie adminCookie = admin();
        emailSender.clear();

        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            Callable<Integer> task = () -> mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(adminCookie)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"No coincide\"}")).andReturn().getResponse().getStatus();
            results.add(pool.submit(task));
        }
        int ok = 0;
        int conflict = 0;
        for (Future<Integer> f : results) {
            int s = f.get();
            ok += s == 200 ? 1 : 0;
            conflict += s == 409 ? 1 : 0;
        }
        pool.shutdown();
        assertThat(ok).isEqualTo(1);
        assertThat(conflict).isEqualTo(5);
        assertThat(emailsTo(email)).hasSize(1);
    }

    @Test
    void approveAndRejectRaceLeavesExactlyOneOutcome() throws Exception {
        long p = createProduct("20.00");
        String email = uniqueEmail("duel");
        Cookie customer = signIn(email);
        String id = checkoutWithProof(customer, p, 1, 141);
        Cookie adminCookie = admin();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<Integer> approved = pool.submit(() -> mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(adminCookie))
                .andReturn().getResponse().getStatus());
        Future<Integer> rejected = pool.submit(() -> mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(adminCookie)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"No\"}")).andReturn().getResponse().getStatus());
        int a = approved.get();
        int r = rejected.get();
        pool.shutdown();
        assertThat(a == 200 ^ r == 200).as("exactly one of approve/reject wins (approve=%d reject=%d)", a, r).isTrue();
        boolean orderExists = orderRepository.findByCheckoutId(id).isPresent();
        assertThat(orderExists).isEqualTo(a == 200);
    }

    // ---------- roles and object-level access ----------

    @Test
    void onlyAdministratorsReachPaymentVerification() throws Exception {
        long p = createProduct("20.00");
        Cookie owner = signIn(uniqueEmail("roles"));
        String id = checkoutWithProof(owner, p, 1, 151);
        String attemptId = firstAttemptId(id, owner);
        List<Cookie> denied = List.of(signInAs(Rol.ASESOR), owner);
        for (Cookie cookie : denied) {
            mockMvc.perform(get("/api/admin/payments").cookie(cookie)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mockMvc.perform(get("/api/admin/payments/" + id).cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/admin/payments/" + id + "/proof/" + attemptId).cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(post("/api/admin/payments/" + id + "/approve").cookie(cookie)).andExpect(status().isForbidden());
            mockMvc.perform(post("/api/admin/payments/" + id + "/reject").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"x\"}")).andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/admin/payments")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(post("/api/admin/payments/" + id + "/approve")).andExpect(status().isUnauthorized());
        poll(owner, id).andExpect(jsonPath("$.status").value("PROOF_SUBMITTED")); // nothing happened
        assertThat(orderRepository.findByCheckoutId(id)).isEmpty();
    }

    // ---------- helpers ----------

    private Long idOfCookie(Cookie cookie) throws Exception {
        String raw = mockMvc.perform(get("/api/auth/me").cookie(cookie)).andReturn().getResponse().getContentAsString();
        return idOf(objectMapper.readTree(raw).get("email").asText());
    }

    /** Reads the checkout ids out of a page response. */
    private final class MvcResultJson {
        private final String raw;

        MvcResultJson(String raw) {
            this.raw = raw;
        }

        List<String> ids() throws Exception {
            List<String> ids = new ArrayList<>();
            objectMapper.readTree(raw).get("content").forEach(n -> ids.add(n.get("checkoutId").asText()));
            return ids;
        }
    }
}
