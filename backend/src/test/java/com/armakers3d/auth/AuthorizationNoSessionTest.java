package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * T048 (Constitution Principle XII, NON-NEGOTIABLE): a request with no, invalid, or expired
 * session receives 401 (spec.md User Story 4 Scenario 4).
 */
class AuthorizationNoSessionTest extends AbstractOtpIntegrationTest {

    @Test
    void noSessionCookieAtAllIsUnauthorized() throws Exception {
        getWithCookie("/api/customers/me", null).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidSessionCookieIsUnauthorized() throws Exception {
        getWithCookie("/api/customers/me", new Cookie("ARM3D_SESSION", "not-a-real-session-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void revokedSessionIsUnauthorized() throws Exception {
        String email = uniqueEmail("revoked-session");
        Cookie sessionCookie = registerAndGetSessionCookie(email);

        var session = sessionRepository.findById(sessionCookie.getValue()).orElseThrow();
        session.revoke(clock.instant());
        sessionRepository.saveAndFlush(session);

        getWithCookie("/api/customers/me", sessionCookie).andExpect(status().isUnauthorized());
    }
}
