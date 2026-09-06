package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T031 (Constitution Principle XII, NON-NEGOTIABLE): an incorrect code is rejected and creates no
 * session (FR-007, spec.md User Story 2 Scenario 1).
 */
class OtpInvalidCodeSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void wrongCodeIsRejectedAndCreatesNoSession() throws Exception {
        String email = uniqueEmail("wrong-code");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);
        String wrongCode = "000000".equals(issuedCode) ? "999999" : "000000";

        var result = verifyOtp(email, wrongCode).andExpect(status().isUnauthorized()).andReturn();

        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNull();
        assertThat(sessionRepository.count()).isZero();
        assertThat(clienteRepository.findByEmail(email)).isEmpty();
    }
}
