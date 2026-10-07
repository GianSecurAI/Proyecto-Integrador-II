package com.armakers3d.shared.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The prod guard must refuse in-memory storage for every guarded feature, users and catalog included. */
class InMemoryStorageGuardTest {

    @Test
    void refusesWhenCatalogIsStillInMemory() {
        var env = new MockEnvironment().withProperty("app.persistence.users", "jpa").withProperty("app.persistence.catalog", "memory").withProperty("app.persistence.orders", "jpa").withProperty("app.persistence.incidents", "jpa");
        assertThatThrownBy(() -> new InMemoryStorageGuard(env).refuse())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("catalog");
    }

    @Test
    void refusesWhenUsersIsStillInMemory() {
        var env = new MockEnvironment().withProperty("app.persistence.users", "memory").withProperty("app.persistence.catalog", "jpa").withProperty("app.persistence.orders", "jpa").withProperty("app.persistence.incidents", "jpa");
        assertThatThrownBy(() -> new InMemoryStorageGuard(env).refuse())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("users");
    }

    @Test
    void refusesWhenOrdersIsStillInMemory() {
        var env = new MockEnvironment().withProperty("app.persistence.users", "jpa").withProperty("app.persistence.catalog", "jpa").withProperty("app.persistence.orders", "memory").withProperty("app.persistence.incidents", "jpa");
        assertThatThrownBy(() -> new InMemoryStorageGuard(env).refuse())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("orders");
    }

    @Test
    void refusesWhenIncidentsIsStillInMemory() {
        var env = new MockEnvironment().withProperty("app.persistence.users", "jpa").withProperty("app.persistence.catalog", "jpa").withProperty("app.persistence.orders", "jpa").withProperty("app.persistence.incidents", "memory");
        assertThatThrownBy(() -> new InMemoryStorageGuard(env).refuse())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("incidents");
    }

    @Test
    void aMissingPropertyCountsAsMemoryBecauseThatIsTheDefault() {
        assertThatThrownBy(() -> new InMemoryStorageGuard(new MockEnvironment()).refuse())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void allowsBootOnlyWhenEveryGuardedFeatureIsDatabaseBacked() {
        var env = new MockEnvironment().withProperty("app.persistence.users", "jpa").withProperty("app.persistence.catalog", "jpa").withProperty("app.persistence.orders", "jpa").withProperty("app.persistence.incidents", "jpa");
        assertThatCode(() -> new InMemoryStorageGuard(env).refuse()).doesNotThrowAnyException();
    }
}
