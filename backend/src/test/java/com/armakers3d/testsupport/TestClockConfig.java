package com.armakers3d.testsupport;

import java.time.Clock;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

/** Replaces the production {@link Clock} bean with a controllable {@link MutableClock} in tests. */
@TestConfiguration
@Profile("test")
public class TestClockConfig {

    @Bean
    @Primary
    public Clock clock() {
        return MutableClock.startingNow();
    }
}
