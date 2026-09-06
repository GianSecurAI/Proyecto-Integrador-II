package com.armakers3d.testsupport;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * A settable {@link Clock} substituted for the production {@code Clock.systemUTC()} bean under
 * the {@code test} profile, so expiry/throttling-window tests (10 minutes, 15 minutes) run
 * instantly instead of requiring real wall-clock waits.
 */
public class MutableClock extends Clock {

    private Instant instant;
    private final ZoneId zone;

    public MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    public static MutableClock startingNow() {
        return new MutableClock(Instant.now(), ZoneId.of("UTC"));
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(instant, zone);
    }

    @Override
    public Instant instant() {
        return instant;
    }

    public void advance(Duration duration) {
        this.instant = this.instant.plus(duration);
    }

    public void reset() {
        this.instant = Instant.now();
    }
}
