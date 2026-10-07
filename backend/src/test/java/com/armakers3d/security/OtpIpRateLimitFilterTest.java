package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.config.OtpPolicyProperties;
import com.armakers3d.auth.security.OtpIpRateLimitFilter;
import com.armakers3d.testsupport.MutableClock;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** The per-IP counter store must stay bounded (security review M3 and DoS: no unbounded in-memory growth). */
class OtpIpRateLimitFilterTest {

    @Test
    void thePerIpCounterMapIsBoundedWhenManyDistinctAddressesArrive() throws Exception {
        var filter = new OtpIpRateLimitFilter(new OtpPolicyProperties(), MutableClock.startingNow(), new ObjectMapper());
        for (int i = 0; i < 10_500; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/otp/request");
            req.setRemoteAddr("10." + (i / 65536) + "." + ((i / 256) % 256) + "." + (i % 256));
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }
        Field f = OtpIpRateLimitFilter.class.getDeclaredField("windows");
        f.setAccessible(true);
        assertThat(((Map<?, ?>) f.get(filter)).size()).isLessThanOrEqualTo(10_000);
    }

    @Test
    void nonOtpPathsAreNeverCounted() throws Exception {
        var filter = new OtpIpRateLimitFilter(new OtpPolicyProperties(), MutableClock.startingNow(), new ObjectMapper());
        for (int i = 0; i < 100; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("GET", "/api/catalog/products"), res, new MockFilterChain());
            assertThat(res.getStatus()).isEqualTo(200);
        }
    }
}
