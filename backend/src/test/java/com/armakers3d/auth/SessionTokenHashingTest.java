package com.armakers3d.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.service.SessionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;

/**
 * Security review M5: the session store must never hold the raw cookie token (a leaked table or backup would
 * otherwise be a set of live sessions). The row id is the SHA-256 hex of the token; the cookie still works.
 */
class SessionTokenHashingTest extends AbstractOtpIntegrationTest {

    @Test
    void theStoreKeepsOnlyTheSha256OfTheTokenNeverTheTokenItself() throws Exception {
        Cookie cookie = registerAndGetSessionCookie(uniqueEmail("hash"));
        String token = cookie.getValue();

        assertThat(sessionJpa.findById(token)).as("raw token must not be a row id").isEmpty();
        String key = SessionService.storageKey(token);
        assertThat(key).hasSize(64).matches("[0-9a-f]{64}").isNotEqualTo(token);
        assertThat(sessionJpa.findById(key)).isPresent();

        // The cookie holding the raw token still authenticates...
        getWithCookie("/api/auth/me", cookie).andExpect(status().isOk());
        // ...but presenting the stored hash as if it were a token does not.
        getWithCookie("/api/auth/me", new Cookie("ARM3D_SESSION", key)).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheHashedRowAndTheCookieStopsWorking() throws Exception {
        Cookie cookie = registerAndGetSessionCookie(uniqueEmail("hash-logout"));
        mockMvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
        assertThat(sessionRepository.findById(SessionService.storageKey(cookie.getValue())).orElseThrow().getRevokedAt())
                .isNotNull();
        getWithCookie("/api/auth/me", cookie).andExpect(status().isUnauthorized());
    }
}
