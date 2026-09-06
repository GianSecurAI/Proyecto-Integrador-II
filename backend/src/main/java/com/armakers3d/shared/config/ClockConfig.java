package com.armakers3d.shared.config;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * A single injectable {@link Clock} bean so time-dependent business rules (OTP expiry, session
 * expiry, throttling windows) are testable without real wall-clock waits. Tests substitute a
 * controllable clock (see test-only MutableClock); production uses the real system clock.
 * {@code @ConditionalOnMissingBean} lets the test context override this with its own bean
 * without a bean-definition conflict.
 */
@Configuration
public class ClockConfig {

    @Bean
    @ConditionalOnMissingBean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
