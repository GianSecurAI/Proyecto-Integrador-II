package com.armakers3d.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Per-account limit on authenticated mutating requests (BE-05, ADR-004 D4/5.5, RNF-15). Defaults: 60
 * mutations per 10 minutes per account. Externalized so the numbers can change without a code change.
 */
@ConfigurationProperties(prefix = "ratelimit")
public class MutationRateLimitProperties {

    private int mutationsPerWindow = 60;
    private int windowMinutes = 10;

    public int getMutationsPerWindow() {
        return mutationsPerWindow;
    }

    public void setMutationsPerWindow(int mutationsPerWindow) {
        this.mutationsPerWindow = mutationsPerWindow;
    }

    public int getWindowMinutes() {
        return windowMinutes;
    }

    public void setWindowMinutes(int windowMinutes) {
        this.windowMinutes = windowMinutes;
    }
}
