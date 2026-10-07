package com.armakers3d.testsupport;

import java.time.Clock;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Shared test configuration for tests under the {@code nodb} profile: a capturing email sender
 * (the production nodb sender deliberately never reveals the OTP) and a controllable clock.
 * Sharing one configuration class lets Spring cache a single application context for all of them.
 */
@TestConfiguration
public class NoDbTestConfig {

    @Bean
    @Primary
    CapturingEmailSender capturingEmailSender() {
        return new CapturingEmailSender();
    }

    @Bean
    @Primary
    Clock nodbTestClock() {
        return MutableClock.startingNow();
    }
}
