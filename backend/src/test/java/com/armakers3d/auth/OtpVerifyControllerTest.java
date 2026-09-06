package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T015: contract test for POST /api/auth/otp/verify happy path — new email results in
 * accountStatus "created", existing email in "existing" (FR-004a, FR-005, FR-006).
 */
class OtpVerifyControllerTest extends AbstractOtpIntegrationTest {

    @Test
    void newEmailCreatesAccountAndSetsSessionCookie() throws Exception {
        String email = uniqueEmail("new-account");
        requestOtp(email);
        String code = emailSender.lastCodeFor(email);

        var result =
                verifyOtp(email, code)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.accountStatus").value("created"))
                        .andReturn();

        assertThat(result.getResponse().getCookie("ARM3D_SESSION")).isNotNull();
        assertThat(clienteRepository.findByEmail(email)).isPresent();
    }

    @Test
    void existingEmailSignsIntoSameAccountWithoutDuplication() throws Exception {
        String email = uniqueEmail("existing-account");
        registerAndGetSessionCookie(email);
        long clienteCountAfterFirstRegistration = clienteRepository.count();

        requestOtp(email);
        String secondCode = emailSender.lastCodeFor(email);

        verifyOtp(email, secondCode)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountStatus").value("existing"));

        assertThat(clienteRepository.count()).isEqualTo(clienteCountAfterFirstRegistration);
    }
}
