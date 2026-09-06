package com.armakers3d.auth;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/**
 * T041 (spec.md User Story 3, Scenario 3; FR-012): once the throttling window for an email has
 * elapsed since its last counted request, a new request must succeed again rather than staying
 * permanently blocked. Uses the injected MutableClock to fast forward past the 15-minute policy
 * default instead of a real wall-clock wait, matching the style of OtpExpiredCodeSecurityTest.
 */
class OtpThrottleWindowResetTest extends AbstractOtpIntegrationTest {

    @Test
    void requestSucceedsAgainOnceThrottleWindowHasElapsed() throws Exception {
        String email = uniqueEmail("throttle-window-reset");

        requestOtp(email).andExpect(status().isAccepted());
        requestOtp(email).andExpect(status().isAccepted());
        requestOtp(email).andExpect(status().isAccepted());

        // Fourth request within the window is throttled (same guarantee as
        // OtpRequestThrottleSecurityTest).
        requestOtp(email).andExpect(status().isTooManyRequests());

        // Once the 15-minute window has fully elapsed since the first counted request, the
        // email's request count within the (now-shifted) window drops back under the limit.
        mutableClock().advance(Duration.ofMinutes(16));

        requestOtp(email).andExpect(status().isAccepted());
    }
}
