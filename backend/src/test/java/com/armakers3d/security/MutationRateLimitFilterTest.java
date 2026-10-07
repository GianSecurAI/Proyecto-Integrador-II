package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.config.MutationRateLimitProperties;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.security.AuthenticatedUser;
import com.armakers3d.auth.security.MutationRateLimitFilter;
import com.armakers3d.testsupport.MutableClock;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/** BE-05: per-account mutation limiter (60 per 10 minutes by default), exercised without Spring. */
class MutationRateLimitFilterTest {

    private MutableClock clock;
    private MutationRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        clock = MutableClock.startingNow();
        filter = new MutationRateLimitFilter(new MutationRateLimitProperties(), clock, new ObjectMapper().findAndRegisterModules());
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticateAs(long id) {
        AuthenticatedUser user = new AuthenticatedUser(id, "u" + id + "@example.test", Rol.CLIENTE);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority(user.authority()))));
    }

    private MockHttpServletResponse call(String method, String uri) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest(method, uri), response, new MockFilterChain());
        return response;
    }

    @Test
    void theSixtyFirstMutationInTheWindowIsRejectedWithRetryAfter() throws Exception {
        authenticateAs(1);
        for (int i = 0; i < 60; i++) {
            assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(200);
        }
        MockHttpServletResponse limited = call("POST", "/api/incidents");

        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(Long.parseLong(limited.getHeader("Retry-After"))).isBetween(1L, 600L);
        assertThat(limited.getContentAsString()).contains("\"code\":\"RATE_LIMITED\"");
    }

    @Test
    void everyMutatingMethodCountsAndReadsNeverDo() throws Exception {
        authenticateAs(1);
        for (int i = 0; i < 500; i++) {
            assertThat(call("GET", "/api/orders").getStatus()).isEqualTo(200);
            assertThat(call("OPTIONS", "/api/orders").getStatus()).isEqualTo(200);
        }
        for (String method : List.of("POST", "PUT", "PATCH", "DELETE")) {
            assertThat(call(method, "/api/x").getStatus()).isEqualTo(200);
        }
        // 4 used so far: 56 more are allowed, then the limit applies across methods
        for (int i = 0; i < 56; i++) {
            assertThat(call("PATCH", "/api/x").getStatus()).isEqualTo(200);
        }
        assertThat(call("DELETE", "/api/x").getStatus()).isEqualTo(429);
        assertThat(call("GET", "/api/orders").getStatus()).isEqualTo(200);
    }

    @Test
    void anotherAccountIsUnaffected() throws Exception {
        authenticateAs(1);
        for (int i = 0; i < 61; i++) {
            call("POST", "/api/incidents");
        }
        assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(429);

        authenticateAs(2);
        assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(200);
    }

    @Test
    void theWindowResetsAfterTheConfiguredMinutes() throws Exception {
        authenticateAs(1);
        for (int i = 0; i < 61; i++) {
            call("POST", "/api/incidents");
        }
        assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(429);

        clock.advance(Duration.ofMinutes(10).minusSeconds(1));
        assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(429);
        clock.advance(Duration.ofSeconds(2));
        assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(200);
    }

    @Test
    void authAndWebhookPathsAreExcludedAndAnonymousRequestsAreSkipped() throws Exception {
        authenticateAs(1);
        for (int i = 0; i < 200; i++) {
            assertThat(call("POST", "/api/auth/logout").getStatus()).isEqualTo(200);
            assertThat(call("POST", "/api/payments/webhooks/fake").getStatus()).isEqualTo(200);
        }
        SecurityContextHolder.clearContext();
        for (int i = 0; i < 200; i++) {
            assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(200); // no account: nothing to key on
        }
        // none of the above consumed the account budget
        authenticateAs(1);
        for (int i = 0; i < 60; i++) {
            assertThat(call("POST", "/api/incidents").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void theKeyMapStaysBounded() throws Exception {
        for (long id = 1; id <= 10_500; id++) {
            authenticateAs(id);
            call("POST", "/api/incidents");
        }
        Field f = MutationRateLimitFilter.class.getDeclaredField("windows");
        f.setAccessible(true);
        assertThat(((Map<?, ?>) f.get(filter)).size()).isLessThanOrEqualTo(MutationRateLimitFilter.MAX_TRACKED_KEYS);
    }

    @Test
    void thePropertiesAreConfigurable() throws Exception {
        MutationRateLimitProperties props = new MutationRateLimitProperties();
        props.setMutationsPerWindow(2);
        props.setWindowMinutes(1);
        filter = new MutationRateLimitFilter(props, clock, new ObjectMapper().findAndRegisterModules());
        authenticateAs(1);

        assertThat(call("POST", "/api/x").getStatus()).isEqualTo(200);
        assertThat(call("POST", "/api/x").getStatus()).isEqualTo(200);
        assertThat(call("POST", "/api/x").getStatus()).isEqualTo(429);
        clock.advance(Duration.ofMinutes(1));
        assertThat(call("POST", "/api/x").getStatus()).isEqualTo(200);
    }
}
