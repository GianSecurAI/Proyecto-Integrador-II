package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * T040 (Constitution Principle XII, NON-NEGOTIABLE): the 4th OTP request for one email inside the
 * throttling window returns 429 with the same generic wording as a normal request — no
 * enumeration leak (FR-012, spec.md User Story 3 Scenario 2). Policy default under test: max 3
 * requests/15 minutes (application-test.yml).
 */
class OtpRequestThrottleSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void fourthRequestWithinWindowIsThrottledWithGenericWording() throws Exception {
        String email = uniqueEmail("request-throttle");

        MockHttpServletResponse first = requestOtp(email).andExpect(status().isAccepted()).andReturn().getResponse();
        requestOtp(email).andExpect(status().isAccepted());
        requestOtp(email).andExpect(status().isAccepted());

        MockHttpServletResponse fourth =
                requestOtp(email).andExpect(status().isTooManyRequests()).andReturn().getResponse();

        // The throttled response must not contain any wording distinguishing it as
        // "account-specific" beyond the same generic acknowledgment style used elsewhere.
        assertThat(fourth.getContentAsString()).doesNotContain(email);
        assertThat(first.getContentAsString()).doesNotContain(email);
    }
}
