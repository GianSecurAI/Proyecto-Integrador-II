package com.armakers3d.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.domain.Rol;
import com.armakers3d.testsupport.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
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
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * Payment proof upload, viewing and cancellation over HTTP (ADR-005): validation by magic bytes, size, state machine,
 * attempt limit, duplicate flag, ownership and the security headers of served proofs.
 */
class PaymentProofApiTest extends AbstractCheckoutApiTest {

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    // ---------- accepted images ----------

    @Test
    void validJpegPngAndWebpAreAcceptedAndTheCheckoutBecomesProofSubmitted() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("proof"));
        byte[][] images = {jpeg(80, 80, 1), png(80, 80, 2), webp(80, 80)};
        String[] types = {"image/jpeg", "image/png", "image/webp"};
        for (int i = 0; i < images.length; i++) {
            String id = startCheckout(customer, p, 1);
            JsonNode body = read(upload(customer, id, images[i], "captura.bin", types[i], "YAPE", "AB12CD34")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("PROOF_SUBMITTED"))
                    .andExpect(jsonPath("$.proofStatus").value("PENDING"))
                    .andExpect(jsonPath("$.expiresAt").value(org.hamcrest.Matchers.nullValue()))
                    .andExpect(jsonPath("$.orderId").value(org.hamcrest.Matchers.nullValue()))
                    .andExpect(jsonPath("$.attemptsRemaining").value(4))
                    .andExpect(jsonPath("$.attempts.length()").value(1))
                    .andExpect(jsonPath("$.attempts[0].number").value(1))
                    .andExpect(jsonPath("$.attempts[0].method").value("YAPE"))
                    .andExpect(jsonPath("$.attempts[0].operationCode").value("AB12CD34"))
                    .andExpect(jsonPath("$.attempts[0].status").value("PENDING")));
            String raw = body.toString();
            assertThat(raw).doesNotContain("sha").doesNotContain("storage").doesNotContain("captura");
        }
    }

    @Test
    void methodIsCaseInsensitiveAndPlinIsAccepted() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("plin"));
        String id = startCheckout(customer, p, 1);
        upload(customer, id, jpeg(64, 64, 3), "x.jpg", "image/jpeg", "plin", null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.attempts[0].method").value("PLIN"))
                .andExpect(jsonPath("$.attempts[0].operationCode").value(org.hamcrest.Matchers.nullValue()));
    }

    // ---------- rejected content ----------

    @Test
    void svgHtmlPdfGifHeicAndExecutablesAreRejectedEvenWithAnImageNameAndContentType() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("types"));
        String id = startCheckout(customer, p, 1);
        byte[][] bad = {
            ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"),
            ascii("<html><body><script>alert(1)</script></body></html>"),
            ascii("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"),
            ascii("GIF89a@\u0000@\u0000\u0000\u0000\u0000;"),
            concat(new byte[] {0, 0, 0, 0x18}, concat(ascii("ftypheic"), new byte[64])),
            concat(ascii("MZ"), new byte[300]),
        };
        for (byte[] content : bad) {
            upload(customer, id, content, "comprobante.png", "image/png", "YAPE", null)
                    .andExpect(status().isUnsupportedMediaType())
                    .andExpect(jsonPath("$.code").value("UNSUPPORTED_IMAGE_TYPE"));
        }
        poll(customer, id).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF")).andExpect(jsonPath("$.attempts.length()").value(0));
    }

    @Test
    void theDeclaredContentTypeAndFileNameAreIgnoredOnlyTheBytesDecide() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("liar"));
        String bad = startCheckout(customer, p, 1);
        upload(customer, bad, ascii("not an image at all"), "foto.jpg", "image/jpeg", "YAPE", null)
                .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.code").value("UNSUPPORTED_IMAGE_TYPE"));

        String good = startCheckout(customer, p, 1);
        byte[] png = png(64, 64, 9);
        JsonNode ok = read(upload(customer, good, png, "index.html", "text/html", "YAPE", null).andExpect(status().isOk()));
        String attemptId = ok.get("attempts").get(0).get("attemptId").asText();
        // served with the type detected from the bytes, not the declared one
        mockMvc.perform(get("/api/checkout/" + good + "/proof/" + attemptId).cookie(customer))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/png"))
                .andExpect(content().bytes(png));
    }

    @Test
    void polyglotTruncatedEmptyAndZeroDimensionFilesAreRejected() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("corrupt"));
        String id = startCheckout(customer, p, 1);
        byte[] script = ascii("<script>alert(document.cookie)</script>");
        upload(customer, id, concat(jpeg(64, 64, 4), script), "a.jpg", "image/jpeg", "YAPE", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROOF_IMAGE"));
        upload(customer, id, concat(png(64, 64, 4), script), "a.png", "image/png", "YAPE", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROOF_IMAGE"));
        byte[] png = png(64, 64, 4);
        upload(customer, id, java.util.Arrays.copyOf(png, png.length / 2), "a.png", "image/png", "YAPE", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROOF_IMAGE"));
        upload(customer, id, new byte[0], "a.png", "image/png", "YAPE", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROOF_IMAGE"));
        byte[] zero = png(64, 64, 4);
        for (int i = 16; i < 24; i++) {
            zero[i] = 0;
        }
        upload(customer, id, zero, "a.png", "image/png", "YAPE", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PROOF_IMAGE"));
        poll(customer, id).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"));
    }

    @Test
    void anOversizedFileIsRejectedWith413AndNothingIsStored() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("big"));
        String id = startCheckout(customer, p, 1);
        byte[] big = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(jpeg(64, 64, 1), 0, big, 0, 4); // starts like a JPEG: only the size decides
        upload(customer, id, big, "big.jpg", "image/jpeg", "YAPE", null)
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
        poll(customer, id).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"));
    }

    @Test
    void aPathTraversalFileNameIsIgnoredAndNeverEchoed() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("path"));
        String id = startCheckout(customer, p, 1);
        String evil = "../../../../etc/passwd\\..\\..\\windows\\system32\\evil.png";
        MvcResult result = upload(customer, id, jpeg(64, 64, 8), evil, "image/jpeg", "YAPE", null)
                .andExpect(status().isOk()).andReturn();
        String raw = result.getResponse().getContentAsString();
        assertThat(raw).doesNotContain("passwd").doesNotContain("evil").doesNotContain("..");
        String attemptId = objectMapper.readTree(raw).get("attempts").get(0).get("attemptId").asText();
        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId).cookie(customer))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "inline; filename=\"payment-proof.jpg\""));
    }

    // ---------- field validation ----------

    @Test
    void methodMustBeYapeOrPlin() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("method"));
        String id = startCheckout(customer, p, 1);
        for (String method : new String[] {null, "", "  ", "BITCOIN", "TARJETA", "YAPE;DROP"}) {
            upload(customer, id, jpeg(64, 64, 1), "a.jpg", "image/jpeg", method, null)
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("method"));
        }
    }

    @Test
    void operationCodeIsOptionalButWhenPresentMustBeSixToTwentyAlphanumerics() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("opcode"));
        String id = startCheckout(customer, p, 1);
        for (String code : new String[] {"abc", "12345", "x".repeat(21), "ab cd ef", "ab-cd-ef", "<script>", "ab12cd\n34"}) {
            upload(customer, id, jpeg(64, 64, 1), "a.jpg", "image/jpeg", "YAPE", code)
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors[0].field").value("operationCode"));
        }
        upload(customer, id, jpeg(64, 64, 1), "a.jpg", "image/jpeg", "YAPE", "   ").andExpect(status().isOk()); // blank = absent
    }

    @Test
    void aMissingFilePartAndANonMultipartBodyAreClientErrors() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("nofile"));
        String id = startCheckout(customer, p, 1);
        mockMvc.perform(multipart("/api/checkout/" + id + "/proof").param("method", "YAPE").cookie(customer))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("file"));
        mockMvc.perform(post("/api/checkout/" + id + "/proof").cookie(customer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"method\":\"YAPE\"}"))
                .andExpect(status().isUnsupportedMediaType());
    }

    // ---------- state machine ----------

    @Test
    void uploadingWhileAProofIsPendingOrAfterPaidExpiredOrCancelledIsAConflict() throws Exception {
        long p = createProduct("10.00");
        String email = uniqueEmail("states");
        Cookie customer = signIn(email);

        String pending = checkoutWithProof(customer, p, 1, 1);
        upload(customer, pending, jpeg(64, 64, 2)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKOUT_STATE_CONFLICT"));

        approve(pending).andExpect(status().isOk());
        upload(customer, pending, jpeg(64, 64, 3)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKOUT_STATE_CONFLICT"));

        String cancelled = startCheckout(customer, p, 1);
        cancel(customer, cancelled).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        upload(customer, cancelled, jpeg(64, 64, 4)).andExpect(status().isConflict());

        String expired = startCheckout(customer, p, 1);
        ((MutableClock) clock).advance(Duration.ofHours(25));
        Cookie again = signIn(email);
        upload(again, expired, jpeg(64, 64, 5)).andExpect(status().isConflict());
        poll(again, expired).andExpect(jsonPath("$.status").value("EXPIRED"));
    }

    @Test
    void aRejectedCheckoutAcceptsANewProofAndKeepsTheHistory() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("again"));
        String id = checkoutWithProof(customer, p, 1, 1);
        reject(id, "El monto no coincide").andExpect(status().isOk());

        poll(customer, id).andExpect(jsonPath("$.status").value("PROOF_REJECTED")).andExpect(jsonPath("$.proofStatus").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("El monto no coincide"));
        upload(customer, id, png(64, 64, 2), "n.png", "image/png", "PLIN", null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PROOF_SUBMITTED"))
                .andExpect(jsonPath("$.proofStatus").value("PENDING")).andExpect(jsonPath("$.rejectionReason").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.attempts.length()").value(2))
                .andExpect(jsonPath("$.attempts[0].status").value("REJECTED"))
                .andExpect(jsonPath("$.attempts[0].rejectionReason").value("El monto no coincide"))
                .andExpect(jsonPath("$.attempts[1].number").value(2))
                .andExpect(jsonPath("$.attempts[1].method").value("PLIN"))
                .andExpect(jsonPath("$.attemptsRemaining").value(3));
    }

    @Test
    void theSixthProofForOneCheckoutIsRejected() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("six"));
        String id = startCheckout(customer, p, 1);
        for (int i = 1; i <= 5; i++) {
            upload(customer, id, jpeg(64, 64, 100 + i)).andExpect(status().isOk());
            reject(id, "Intento " + i + " invalido").andExpect(status().isOk());
        }
        poll(customer, id).andExpect(jsonPath("$.attemptsRemaining").value(0)).andExpect(jsonPath("$.status").value("PROOF_REJECTED"));
        upload(customer, id, jpeg(64, 64, 999)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROOF_ATTEMPTS_EXCEEDED"));
        poll(customer, id).andExpect(jsonPath("$.attempts.length()").value(5));
        cancel(customer, id).andExpect(status().isOk()); // the customer can still walk away
    }

    @Test
    void twoConcurrentUploadsForTheSameCheckoutLeaveExactlyOneProof() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("race"));
        String id = startCheckout(customer, p, 1);
        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            final int seed = 200 + i;
            Callable<Integer> task = () -> upload(customer, id, jpeg(64, 64, seed)).andReturn().getResponse().getStatus();
            results.add(pool.submit(task));
        }
        int ok = 0;
        int conflict = 0;
        for (Future<Integer> f : results) {
            int status = f.get();
            ok += status == 200 ? 1 : 0;
            conflict += status == 409 ? 1 : 0;
        }
        pool.shutdown();
        assertThat(ok).isEqualTo(1);
        assertThat(conflict).isEqualTo(5);
        poll(customer, id).andExpect(jsonPath("$.attempts.length()").value(1));
    }

    // ---------- cancel ----------

    @Test
    void theCustomerCanCancelBeforePaidAndCancelIsIdempotent() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("cancel"));

        String awaiting = startCheckout(customer, p, 1);
        cancel(customer, awaiting).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        cancel(customer, awaiting).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));

        String submitted = checkoutWithProof(customer, p, 1, 1);
        cancel(customer, submitted).andExpect(status().isOk());
        approve(submitted).andExpect(status().isConflict()); // the administrator can no longer approve it

        String rejected = checkoutWithProof(customer, p, 1, 2);
        reject(rejected, "No coincide").andExpect(status().isOk());
        cancel(customer, rejected).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));

        String paid = checkoutWithProof(customer, p, 1, 3);
        approve(paid).andExpect(status().isOk());
        cancel(customer, paid).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKOUT_STATE_CONFLICT"));
        poll(customer, paid).andExpect(jsonPath("$.status").value("PAID"));
    }

    @Test
    void cancelFreesTheOpenCheckoutSlot() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("slots"));
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            ids.add(startCheckout(customer, p, 1));
        }
        submit(customer, checkoutBody(item(p, 1))).andExpect(status().isConflict());
        cancel(customer, ids.get(0)).andExpect(status().isOk());
        submit(customer, checkoutBody(item(p, 1))).andExpect(status().isCreated());
    }

    // ---------- duplicate screenshot flag ----------

    @Test
    void theSameScreenshotOnAnotherCheckoutIsFlaggedForTheAdministratorButNotRejected() throws Exception {
        long p = createProduct("10.00");
        Cookie ana = signIn(uniqueEmail("ana"));
        Cookie luis = signIn(uniqueEmail("luis"));
        byte[] shared = jpeg(64, 64, 4242);

        String first = startCheckout(ana, p, 1);
        uploadOk(ana, first, shared);
        String second = startCheckout(luis, p, 1);
        uploadOk(luis, second, shared); // accepted: it is only a flag

        adminGet("/api/admin/payments/" + second).andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicateProofWarning").value(true))
                .andExpect(jsonPath("$.attempts[0].duplicateProofWarning").value(true));
        adminGet("/api/admin/payments/" + first).andExpect(jsonPath("$.duplicateProofWarning").value(true));

        String unique = startCheckout(luis, p, 1);
        uploadOk(luis, unique, jpeg(64, 64, 4243));
        adminGet("/api/admin/payments/" + unique).andExpect(jsonPath("$.duplicateProofWarning").value(false));

        // re-uploading the same image on the SAME checkout (after a rejection) is not "another checkout"
        String same = startCheckout(ana, p, 1);
        uploadOk(ana, same, jpeg(64, 64, 777));
        reject(same, "Borroso").andExpect(status().isOk());
        uploadOk(ana, same, jpeg(64, 64, 777));
        adminGet("/api/admin/payments/" + same).andExpect(jsonPath("$.duplicateProofWarning").value(false));
    }

    // ---------- ownership and roles ----------

    @Test
    void anotherCustomersCheckoutAndProofAreInvisible() throws Exception {
        long p = createProduct("10.00");
        Cookie owner = signIn(uniqueEmail("owner"));
        Cookie other = signIn(uniqueEmail("other"));
        String id = checkoutWithProof(owner, p, 1, 1);
        String attemptId = firstAttemptId(id, owner);
        String unknown = UUID.randomUUID().toString();

        poll(other, id).andExpect(status().isNotFound());
        upload(other, id, jpeg(64, 64, 2)).andExpect(status().isNotFound());
        cancel(other, id).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId).cookie(other)).andExpect(status().isNotFound());
        // identical to a checkout that does not exist
        mockMvc.perform(get("/api/checkout/" + unknown + "/proof/" + attemptId).cookie(owner)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + UUID.randomUUID()).cookie(owner)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/checkout/not-a-uuid/proof/x").cookie(owner)).andExpect(status().isNotFound());
        // the real owner still sees everything
        poll(owner, id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PROOF_SUBMITTED"));
    }

    @Test
    void staffAndAnonymousCannotUseTheCustomerProofEndpoints() throws Exception {
        long p = createProduct("10.00");
        Cookie owner = signIn(uniqueEmail("owner"));
        String id = checkoutWithProof(owner, p, 1, 1);
        String attemptId = firstAttemptId(id, owner);
        for (Rol rol : new Rol[] {Rol.ASESOR, Rol.ADMINISTRADOR}) {
            Cookie staff = signInAs(rol);
            upload(staff, id, jpeg(64, 64, 2)).andExpect(status().isForbidden());
            cancel(staff, id).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId).cookie(staff)).andExpect(status().isForbidden());
        }
        upload(null, id, jpeg(64, 64, 2)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/checkout/" + id + "/cancel")).andExpect(status().isUnauthorized());
    }

    // ---------- serving proofs ----------

    @Test
    void theOwnerGetsTheProofWithTheHardenedHeaders() throws Exception {
        long p = createProduct("10.00");
        Cookie owner = signIn(uniqueEmail("serve"));
        String id = startCheckout(owner, p, 1);
        byte[] image = webp(90, 90);
        String attemptId = read(upload(owner, id, image, "../x.exe", "application/x-msdownload", "YAPE", null).andExpect(status().isOk()))
                .get("attempts").get(0).get("attemptId").asText();

        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId).cookie(owner))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/webp"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"payment-proof.webp\""))
                .andExpect(content().bytes(image));
    }

    @Test
    void cancellingKeepsTheProofViewableByItsOwner() throws Exception {
        long p = createProduct("10.00");
        Cookie owner = signIn(uniqueEmail("keep"));
        String id = checkoutWithProof(owner, p, 1, 1);
        String attemptId = firstAttemptId(id, owner);
        cancel(owner, id).andExpect(status().isOk());
        mockMvc.perform(get("/api/checkout/" + id + "/proof/" + attemptId).cookie(owner)).andExpect(status().isOk());
    }

    @Test
    void logsNeverContainTheFileNameTheOperationCodeOrTheReasonText() throws Exception {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger("com.armakers3d");
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            long p = createProduct("10.00");
            Cookie customer = signIn(uniqueEmail("logs"));
            String id = startCheckout(customer, p, 1);
            upload(customer, id, jpeg(64, 64, 55), "SECRETFILENAME.jpg", "image/jpeg", "YAPE", "OPCODE123456").andExpect(status().isOk());
            upload(customer, id, jpeg(64, 64, 56), "SECRETFILENAME2.jpg", "image/jpeg", "YAPE", null).andExpect(status().isConflict());
            reject(id, "MOTIVOSECRETO del administrador").andExpect(status().isOk());
        } finally {
            logger.detachAppender(appender);
        }
        String logs = appender.list.stream().map(ch.qos.logback.classic.spi.ILoggingEvent::getFormattedMessage)
                .reduce("", (a, b) -> a + "\n" + b);
        assertThat(logs).contains("payment.proof.submitted").contains("payment.rejected");
        assertThat(logs).doesNotContain("SECRETFILENAME").doesNotContain("OPCODE123456").doesNotContain("MOTIVOSECRETO");
    }
}
