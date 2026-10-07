package com.armakers3d.shared.config;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Fail-fast guard (Principle XIV, backend-foundation.md section 11): a deployed environment
 * must never silently keep feature data in process memory. Active under EVERY profile except the three
 * explicit development/test ones ({@code local}, {@code nodb}, {@code test}), so a misspelled profile, the
 * implicit {@code default} profile or {@code prod} all fail closed (security review H4; it used to guard
 * {@code prod} only). For every feature listed in
 * {@link #FEATURES}, boot aborts there unless {@code app.persistence.<feature>} is set
 * to something other than {@code memory} (a missing property counts as {@code memory}, the default).
 * Replaces the users-only guard; add a feature name here when its in-memory adapter is introduced.
 */
@Component
@Profile("!local & !nodb & !test")
public class InMemoryStorageGuard {

    static final List<String> FEATURES = List.of("users", "catalog", "orders", "incidents");

    private final Environment environment;

    public InMemoryStorageGuard(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void refuse() {
        List<String> inMemory = new ArrayList<>();
        for (String feature : FEATURES) {
            if ("memory".equals(environment.getProperty("app.persistence." + feature, "memory"))) {
                inMemory.add(feature);
            }
        }
        if (!inMemory.isEmpty()) {
            throw new IllegalStateException(
                    "Features stored in memory (app.persistence.<feature>=memory) are not allowed outside the"
                            + " local, nodb and test profiles: " + inMemory + ". Deliver the JPA adapter + migration first.");
        }
    }
}
