package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T014: contract test for POST /api/auth/otp/request — identical 202 acknowledgment for both a
 * new and an already-registered email (FR-004).
 */
class OtpRequestControllerTest extends AbstractOtpIntegrationTest {

    @Test
    void returnsGenericAcceptedForNeverSeenEmail() throws Exception {
        String email = uniqueEmail("brand-new");

        requestOtp(email)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("If this email is valid, a code has been sent."));
    }

    @Test
    void returnsIdenticalGenericAcceptedForAlreadyRegisteredEmail() throws Exception {
        String email = uniqueEmail("returning");
        // Register the account first via the full happy path.
        registerAndGetSessionCookie(email);
        emailSender.clear();

        requestOtp(email)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("If this email is valid, a code has been sent."));
    }

    @Test
    void rejectsMissingEmailWithBadRequest() throws Exception {
        mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                                        "/api/auth/otp/request")
                                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMalformedEmailWithBadRequest() throws Exception {
        requestOtp("not-an-email").andExpect(status().isBadRequest());
    }
}
