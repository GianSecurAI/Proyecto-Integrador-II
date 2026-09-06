package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * T016 (Constitution Principle XII, security-sensitive/NON-NEGOTIABLE): the request-step response
 * status and body are indistinguishable for an existing vs. non-existing email (FR-004
 * enumeration guard). This is the acceptance criterion for FR-004: "no one without access to
 * that email's inbox can determine account existence by probing the request step."
 */
class OtpEnumerationSecurityTest extends AbstractOtpIntegrationTest {

    @Test
    void requestResponseIsIdenticalForExistingAndNonExistingEmail() throws Exception {
        String existingEmail = uniqueEmail("known");
        registerAndGetSessionCookie(existingEmail);
        emailSender.clear();

        String neverSeenEmail = uniqueEmail("unknown");

        MockHttpServletResponse existingResponse = requestOtp(existingEmail).andReturn().getResponse();
        MockHttpServletResponse newResponse = requestOtp(neverSeenEmail).andReturn().getResponse();

        assertThat(existingResponse.getStatus()).isEqualTo(newResponse.getStatus());
        assertThat(existingResponse.getContentAsString()).isEqualTo(newResponse.getContentAsString());
    }

    @Test
    void requestResponseNeverRevealsAccountExistenceInHeadersEither() throws Exception {
        String existingEmail = uniqueEmail("known-headers");
        registerAndGetSessionCookie(existingEmail);
        emailSender.clear();
        String neverSeenEmail = uniqueEmail("unknown-headers");

        MockHttpServletResponse existingResponse = requestOtp(existingEmail).andReturn().getResponse();
        MockHttpServletResponse newResponse = requestOtp(neverSeenEmail).andReturn().getResponse();

        // Neither response step at /request ever sets a session cookie (only /verify does),
        // regardless of existence — a stray cookie would itself leak existence information.
        assertThat(existingResponse.getCookie("ARM3D_SESSION")).isNull();
        assertThat(newResponse.getCookie("ARM3D_SESSION")).isNull();
    }
}
