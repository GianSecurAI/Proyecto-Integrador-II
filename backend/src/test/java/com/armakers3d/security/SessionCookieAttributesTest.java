package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.config.SessionProperties;
import com.armakers3d.auth.domain.AuthenticatedSession;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryAuthenticatedSessionRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryClienteRepository;
import com.armakers3d.auth.service.SessionService;
import com.armakers3d.testsupport.MutableClock;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/** Cookie attributes of the session (H3 documented decision: SameSite=Strict, HttpOnly, Secure outside local dev). */
class SessionCookieAttributesTest {

    private static SessionService service(boolean secure) {
        var props = new SessionProperties();
        props.setCookieSecure(secure);
        var clock = MutableClock.startingNow();
        return new SessionService(new InMemoryAuthenticatedSessionRepository(), new InMemoryClienteRepository(), clock, props);
    }

    @Test
    void theSessionCookieIsHttpOnlySameSiteStrictAndSecureByDefaultConfiguration() {
        var response = new MockHttpServletResponse();
        var now = MutableClock.startingNow().instant();
        var session = new AuthenticatedSession("tok", 1L, Rol.CLIENTE, now, now.plus(Duration.ofHours(1)));
        service(true).attachCookie(response, session);
        assertThat(response.getHeader("Set-Cookie"))
                .contains("HttpOnly").contains("Secure").contains("SameSite=Strict").contains("Path=/");
    }

    @Test
    void theClearingCookieKeepsTheSameProtectiveAttributes() {
        var response = new MockHttpServletResponse();
        service(true).clearCookie(response);
        assertThat(response.getHeader("Set-Cookie"))
                .contains("Max-Age=0").contains("HttpOnly").contains("Secure").contains("SameSite=Strict");
    }

    @Test
    void theShippedDefaultKeepsSecureOn() {
        assertThat(new SessionProperties().isCookieSecure()).isTrue();
    }
}
