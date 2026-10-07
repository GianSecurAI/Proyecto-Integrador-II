package com.armakers3d.payments;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** The per-checkout byte cap of the in-memory proof storage answers 413 and leaves the checkout untouched. */
@TestPropertySource(properties = "app.payments.proof.storage-max-bytes-per-checkout=100")
class PaymentProofCheckoutCapApiTest extends AbstractCheckoutApiTest {

    @Test
    void aCheckoutThatWouldHoldMoreThanItsByteBudgetGets413() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("cap"));
        String id = startCheckout(customer, p, 1);
        upload(customer, id, jpeg(64, 64, 1))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
        poll(customer, id).andExpect(jsonPath("$.status").value("AWAITING_PAYMENT_PROOF"));
    }
}
