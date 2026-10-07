package com.armakers3d.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.shared.config.InMemoryStorageGuard;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * Security review H4: the in-memory storage guard must fail closed under EVERY profile except the explicit
 * local, nodb and test ones. It used to guard only {@code prod}, so a missing or misspelled
 * SPRING_PROFILES_ACTIVE (the old default was {@code local}) booted a "deployment" on process memory.
 */
class InMemoryStorageGuardProfileTest {

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(InMemoryStorageGuard.class);

    @Test
    void failsWithNoActiveProfileAtAll() {
        runner.run(ctx -> assertThat(ctx).hasFailed());
    }

    @Test
    void failsUnderProdAndUnderAMisspelledOrUnknownProfile() {
        for (String profile : new String[] {"prod", "production", "staging", "locall"}) {
            runner.withPropertyValues("spring.profiles.active=" + profile)
                    .run(ctx -> assertThat(ctx).as(profile).hasFailed());
        }
    }

    @Test
    void doesNotApplyToTheThreeExplicitDevelopmentProfiles() {
        for (String profile : new String[] {"local", "nodb", "test"}) {
            runner.withPropertyValues("spring.profiles.active=" + profile)
                    .run(ctx -> assertThat(ctx).as(profile).hasNotFailed());
        }
    }

    @Test
    void passesUnderADeploymentProfileOnceEveryFeatureIsDatabaseBacked() {
        runner.withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.persistence.users=jpa",
                        "app.persistence.catalog=jpa",
                        "app.persistence.orders=jpa",
                        "app.persistence.incidents=jpa",
                        "app.persistence.payments=jpa",
                        "app.persistence.proofs=jpa")
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }
}
