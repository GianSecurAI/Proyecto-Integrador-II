package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T039 (Constitution Principle XII, NON-NEGOTIABLE): the 6th consecutive wrong attempt against
 * one issued code returns 429 and permanently blocks that code (FR-011, spec.md User Story 3
 * Scenario 1). Policy default under test: max 5 attempts (application-test.yml).
 */
class OtpAttemptThrottleSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void sixthConsecutiveWrongAttemptIsBlockedEvenWithTheCorrectCodeAfterward() throws Exception {
        String email = uniqueEmail("attempt-throttle");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);
        String wrongCode = "000000".equals(issuedCode) ? "999999" : "000000";

        for (int attempt = 1; attempt <= 5; attempt++) {
            verifyOtp(email, wrongCode).andExpect(status().isUnauthorized());
        }

        // 6th attempt is blocked outright, even though it uses the wrong code again...
        verifyOtp(email, wrongCode).andExpect(status().isTooManyRequests());

        // ...and even the correct code no longer works once locked out (must request a new one).
        var result = verifyOtp(email, issuedCode).andExpect(status().isTooManyRequests()).andReturn();
        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNull();
        assertThat(clienteRepository.findByEmail(email)).isEmpty();
    }
}
