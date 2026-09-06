package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/**
 * T032 (Constitution Principle XII, NON-NEGOTIABLE): a code submitted after its expiration is
 * rejected (FR-008, spec.md User Story 2 Scenario 2). Uses the injected MutableClock to fast
 * forward past the 10-minute policy default instead of a real wall-clock wait.
 */
class OtpExpiredCodeSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void expiredCodeIsRejectedEvenIfOtherwiseCorrect() throws Exception {
        String email = uniqueEmail("expired-code");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);

        mutableClock().advance(Duration.ofMinutes(11));

        var result = verifyOtp(email, issuedCode).andExpect(status().isGone()).andReturn();

        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNull();
        assertThat(clienteRepository.findByEmail(email)).isEmpty();
    }
}
