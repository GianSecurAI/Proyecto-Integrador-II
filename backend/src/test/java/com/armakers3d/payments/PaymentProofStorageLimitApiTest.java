package com.armakers3d.payments;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** The in-memory proof storage refuses (it never grows without bound) and the API answers with the right error. */
@TestPropertySource(properties = {"app.payments.proof.storage-max-total-bytes=100", "app.persistence.proofs=memory"})
class PaymentProofStorageLimitApiTest extends AbstractCheckoutApiTest {

    @Test
    void whenTheStorageIsFullAnUploadIsA503AndTheCheckoutStaysAwaiting() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("full"));
        String id = startCheckout(customer, p, 1);
        upload(customer, id, jpeg(64, 64, 1)) // far larger than the 100-byte cap
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PROOF_STORAGE_UNAVAILABLE"));
        poll(customer, id).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF")).andExpect(jsonPath("$.attempts.length()").value(0));
    }
}
