package com.armakers3d.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.armakers3d.testsupport.MutableClock;
import com.armakers3d.users.AbstractNoDbRbacTest;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Security review M3: the public OTP endpoints are throttled per client IP, independently of the per-email
 * limits, so one client cannot rotate through many emails (mail bombing, code-table flooding) or spray guesses
 * across many accounts. Low caps are set here (3 request calls, 4 verify calls per window) for a dedicated context.
 */
@TestPropertySource(properties = {"otp.ip-max-request-calls=3", "otp.ip-max-verify-calls=4"})
class OtpIpRateLimitApiTest extends AbstractNoDbRbacTest {

    private ResultActions request(String email, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/otp/request")
                .with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email))));
    }

    private ResultActions verify(String email, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/otp/verify")
                .with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "code", "000000"))));
    }

    @Test
    void aSingleIpRotatingEmailsIsCutOffAfterTheCapAndOtherIpsAreUnaffected() throws Exception {
        String ip = "203.0.113.10";
        for (int i = 0; i < 3; i++) {
            request(uniqueEmail("rot" + i), ip).andExpect(status().isAccepted());
        }
        request(uniqueEmail("rot-over"), ip)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"));
        request(uniqueEmail("other-ip"), "203.0.113.11").andExpect(status().isAccepted());
    }

    @Test
    void verifyCallsFromOneIpAreCappedAcrossDifferentAccounts() throws Exception {
        String ip = "203.0.113.20";
        for (int i = 0; i < 4; i++) {
            verify(uniqueEmail("spray" + i), ip).andExpect(status().isUnauthorized());
        }
        verify(uniqueEmail("spray-over"), ip).andExpect(status().isTooManyRequests());
    }

    @Test
    void theCapResetsWhenTheWindowHasPassed() throws Exception {
        String ip = "203.0.113.30";
        for (int i = 0; i < 3; i++) {
            request(uniqueEmail("win" + i), ip).andExpect(status().isAccepted());
        }
        request(uniqueEmail("win-over"), ip).andExpect(status().isTooManyRequests());
        ((MutableClock) clock).advance(Duration.ofMinutes(16));
        request(uniqueEmail("win-after"), ip).andExpect(status().isAccepted());
    }

    @Test
    void otherEndpointsAreNotAffectedByTheOtpIpCap() throws Exception {
        String ip = "203.0.113.40";
        for (int i = 0; i < 4; i++) {
            request(uniqueEmail("iso" + i), ip);
        }
        mockMvc.perform(get("/api/catalog/products").with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                }))
                .andExpect(status().isOk());
    }
}
