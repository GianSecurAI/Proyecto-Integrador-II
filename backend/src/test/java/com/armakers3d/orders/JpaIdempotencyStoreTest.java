package com.armakers3d.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.armakers3d.orders.repository.IdempotencyStore;
import com.armakers3d.orders.repository.IdempotencyStore.Outcome;
import com.armakers3d.shared.persistence.JpaTestData;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** Contract of the idempotency port on the PostgreSQL adapter (H2 in PostgreSQL mode, Flyway-migrated). */
@SpringBootTest(properties = "app.persistence.orders=jpa")
@ActiveProfiles("test")
class JpaIdempotencyStoreTest {

    private static final Instant T0 = Instant.parse("2026-10-06T10:00:00Z");
    private static final Duration TTL = Duration.ofHours(24);

    @Autowired IdempotencyStore store;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        JpaTestData.seed(jdbc);
    }

    @AfterEach
    void cleanUp() {
        JpaTestData.reset(jdbc);
    }

    @Test
    void firstCallCreatesAndSameFingerprintReplaysWithoutCreatingAgain() {
        AtomicInteger creations = new AtomicInteger();
        var first = store.executeOnce(1L, "k", "fp", T0, TTL, () -> "PED-" + creations.incrementAndGet());
        var second = store.executeOnce(1L, "k", "fp", T0.plusSeconds(5), TTL, () -> "PED-" + creations.incrementAndGet());

        assertThat(first.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(second.outcome()).isEqualTo(Outcome.REPLAYED);
        assertThat(second.orderId()).isEqualTo(first.orderId());
        assertThat(creations).hasValue(1);
    }

    @Test
    void differentFingerprintIsAMismatchAndNeverCreates() {
        store.executeOnce(1L, "k", "fp", T0, TTL, () -> "PED-1");

        var result = store.executeOnce(1L, "k", "other", T0, TTL, () -> {
            throw new AssertionError("must not create");
        });

        assertThat(result.outcome()).isEqualTo(Outcome.MISMATCH);
        assertThat(result.orderId()).isNull();
    }

    @Test
    void scopeIsPerCustomerAndPerKey() {
        store.executeOnce(1L, "k", "fp", T0, TTL, () -> "PED-1");

        assertThat(store.executeOnce(2L, "k", "fp", T0, TTL, () -> "PED-2").outcome()).isEqualTo(Outcome.CREATED);
        assertThat(store.executeOnce(1L, "k2", "fp", T0, TTL, () -> "PED-3").outcome()).isEqualTo(Outcome.CREATED);
    }

    @Test
    void entryExpiresAfterTtlAndTheKeyCanBeReusedWithAnyContent() {
        store.executeOnce(1L, "k", "fp", T0, TTL, () -> "PED-1");

        var justBefore = store.executeOnce(1L, "k", "fp", T0.plus(TTL).minusSeconds(1), TTL, () -> "PED-X");
        var after = store.executeOnce(1L, "k", "different", T0.plus(TTL), TTL, () -> "PED-2");

        assertThat(justBefore.outcome()).isEqualTo(Outcome.REPLAYED);
        assertThat(after.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(after.orderId()).isEqualTo("PED-2");
    }

    @Test
    void aFailingCreateRemembersNothing() {
        assertThatThrownBy(() -> store.executeOnce(1L, "k", "fp", T0, TTL, () -> {
                    throw new IllegalStateException("boom");
                }))
                .isInstanceOf(IllegalStateException.class);

        assertThat(store.executeOnce(1L, "k", "fp", T0, TTL, () -> "PED-1").outcome()).isEqualTo(Outcome.CREATED);
    }

    @Test
    void concurrentRequestsWithTheSameKeyCreateExactlyOnce() throws Exception {
        AtomicInteger creations = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<Future<IdempotencyStore.Result>> futures = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            futures.add(pool.submit(() ->
                    store.executeOnce(1L, "race", "fp", T0, TTL, () -> "PED-" + creations.incrementAndGet())));
        }
        List<IdempotencyStore.Result> results = new ArrayList<>();
        for (Future<IdempotencyStore.Result> f : futures) {
            results.add(f.get());
        }
        pool.shutdown();

        assertThat(results.stream().filter(r -> r.outcome() == Outcome.CREATED)).hasSize(1);
        assertThat(results.stream().map(IdempotencyStore.Result::orderId).distinct()).hasSize(1);
    }
}
