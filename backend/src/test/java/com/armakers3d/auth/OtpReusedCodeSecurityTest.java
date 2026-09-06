package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T033 (Constitution Principle XII, NON-NEGOTIABLE): a code already used once is rejected on a
 * second submission (FR-009, FR-010, spec.md User Story 2 Scenario 3).
 */
class OtpReusedCodeSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void alreadyUsedCodeIsRejectedOnSecondSubmission() throws Exception {
        String email = uniqueEmail("reused-code");
        requestOtp(email);
        String issuedCode = emailSender.lastCodeFor(email);

        verifyOtp(email, issuedCode).andExpect(status().isOk());
        verifyOtp(email, issuedCode).andExpect(status().isGone());
    }
}
