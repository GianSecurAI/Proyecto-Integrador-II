package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/**
 * T034 (Constitution Principle XII, NON-NEGOTIABLE): a superseded (previous) code is rejected
 * once a newer code has been requested for the same email (FR-013, spec.md User Story 2
 * Scenario 4).
 *
 * <p>Verification always evaluates against the single newest row for the email (FR-003), so
 * submitting the superseded code compares against the *new* row's hash and naturally falls
 * through to the same "doesn't match" (401) path as any other incorrect code, rather than a
 * separately-worded "superseded" response — this is a deliberate simplification documented in
 * {@code OtpService.verifyOtp}, not an oversight.
 */
class OtpSupersededCodeSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void supersededCodeIsRejectedOnceANewerCodeWasRequested() throws Exception {
        String email = uniqueEmail("superseded-code");
        requestOtp(email);
        String firstCode = emailSender.lastCodeFor(email);

        requestOtp(email);
        String secondCode = emailSender.lastCodeFor(email);
        assertThat(secondCode).isNotEqualTo(firstCode);

        // The superseded (first) code must never verify successfully again.
        verifyOtp(email, firstCode).andExpect(status().isUnauthorized());

        // The newest code must still work.
        verifyOtp(email, secondCode).andExpect(status().isOk());
    }
}
