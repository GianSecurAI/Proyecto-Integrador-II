package com.armakers3d.payments;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** The multipart proof upload goes through the per-account mutation limiter like every other POST (ADR-005). */
@TestPropertySource(properties = "ratelimit.mutations-per-window=3")
class ProofUploadRateLimitApiTest extends AbstractCheckoutApiTest {

    @Test
    void theFourthMutationInTheWindowIncludingMultipartUploadsIsThrottled() throws Exception {
        long p = createProduct("10.00");
        Cookie customer = signIn(uniqueEmail("limited"));
        String id = startCheckout(customer, p, 1); // 1
        upload(customer, id, jpeg(64, 64, 1)).andExpect(status().isOk()); // 2
        upload(customer, id, jpeg(64, 64, 2)).andExpect(status().isConflict()); // 3 (pending proof, still counted)
        upload(customer, id, jpeg(64, 64, 3))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        poll(customer, id).andExpect(status().isOk()); // reads are never limited
    }
}
