package com.armakers3d.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.auth.AbstractOtpIntegrationTest;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/** BE-05 wired into the real security chain: after authentication, keyed by account, with the error envelope. */
@TestPropertySource(properties = {"ratelimit.mutations-per-window=3", "ratelimit.window-minutes=10"})
class MutationRateLimitApiTest extends AbstractOtpIntegrationTest {

    private ResultActions updateProfile(Cookie cookie) throws Exception {
        return mockMvc.perform(put("/api/customers/me").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"Ana\",\"lastName\":\"Perez\",\"phone\":\"999888777\"}"));
    }

    @Test
    void theFourthMutationIs429ForThatAccountOnlyAndReadsAndAuthAreNeverLimited() throws Exception {
        Cookie a = registerAndGetSessionCookie(uniqueEmail("limit-a"));
        Cookie b = registerAndGetSessionCookie(uniqueEmail("limit-b"));

        for (int i = 0; i < 3; i++) {
            updateProfile(a).andExpect(status().isOk());
        }
        updateProfile(a).andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // reads of the limited account still work
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/customers/me").cookie(a)).andExpect(status().isOk());
        }
        // another account has its own budget
        updateProfile(b).andExpect(status().isOk());

        // the window resets
        mutableClock().advance(Duration.ofMinutes(11));
        updateProfile(a).andExpect(status().isOk());

        // /api/auth/** is outside this limiter (it has its own): logouts are not counted
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/logout").cookie(b)).andExpect(status().is2xxSuccessful());
        }
    }
}
