package com.armakers3d.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.armakers3d.auth.domain.Cliente;
import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.Rol;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryAuthenticatedSessionRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryClienteRepository;
import com.armakers3d.auth.infrastructure.inmemory.InMemoryCodigoOtpRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Runs the shared adapter contracts against the in-memory adapters (plain JUnit, no Spring). */
class InMemoryAdaptersContractTest {

    @Nested
    class ClienteContract extends ClienteRepositoryContract {
        private final InMemoryClienteRepository repo = new InMemoryClienteRepository();

        @Override
        protected ClienteRepository repository() {
            return repo;
        }
    }

    @Nested
    class CodigoOtpContract extends CodigoOtpRepositoryContract {
        private final InMemoryCodigoOtpRepository repo = new InMemoryCodigoOtpRepository();

        @Override
        protected CodigoOtpRepository repository() {
            return repo;
        }
    }

    @Nested
    class SessionContract extends AuthenticatedSessionRepositoryContract {
        private final InMemoryAuthenticatedSessionRepository repo = new InMemoryAuthenticatedSessionRepository();
        private final java.util.concurrent.atomic.AtomicLong nextClienteId = new java.util.concurrent.atomic.AtomicLong();

        @Override
        protected AuthenticatedSessionRepository repository() {
            return repo;
        }

        @Override
        protected Long existingClienteId() {
            return nextClienteId.incrementAndGet();
        }
    }

    // In-memory-specific: thread safety (the JPA adapter relies on single-statement SQL updates).

    @Test
    void concurrentAttemptIncrementsAreNeverLost() throws Exception {
        InMemoryCodigoOtpRepository repo = new InMemoryCodigoOtpRepository();
        Instant t0 = Instant.parse("2026-01-01T10:00:00Z");
        CodigoOtp saved = repo.save(new CodigoOtp("race@example.test", "h", t0, t0.plusSeconds(600)));

        List<Integer> results = runConcurrently(64, () -> repo.incrementAttemptCount(saved.getId()));

        assertThat(results).doesNotHaveDuplicates().hasSize(64);
        assertThat(repo.findLatestByEmail("race@example.test").orElseThrow().getAttemptCount())
                .isEqualTo(64);
    }

    @Test
    void concurrentVerificationOfTheSameCodeSucceedsForExactlyOneCaller() throws Exception {
        InMemoryCodigoOtpRepository repo = new InMemoryCodigoOtpRepository();
        Instant t0 = Instant.parse("2026-01-01T10:00:00Z");
        CodigoOtp saved = repo.save(new CodigoOtp("single-use@example.test", "h", t0, t0.plusSeconds(600)));

        List<Boolean> results = runConcurrently(32, () -> repo.markVerifiedIfPending(saved.getId(), t0));

        assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
    }

    @Test
    void concurrentSavesAssignDistinctIdsAndNeverDuplicateAnEmail() throws Exception {
        InMemoryClienteRepository repo = new InMemoryClienteRepository();
        Instant t0 = Instant.parse("2026-01-01T10:00:00Z");
        AtomicInteger n = new AtomicInteger();

        List<Long> ids =
                runConcurrently(50, () -> repo.save(new Cliente("u" + n.incrementAndGet() + "@example.test", t0)).getId());
        assertThat(ids).doesNotHaveDuplicates();

        List<Boolean> sameEmail =
                runConcurrently(20, () -> {
                    try {
                        repo.save(Cliente.provisioned("same@example.test", Rol.CLIENTE, t0));
                        return true;
                    } catch (IllegalStateException e) {
                        return false;
                    }
                });
        assertThat(sameEmail.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
    }

    /** Starts all tasks at the same instant to maximize contention. */
    private static <T> List<T> runConcurrently(int threads, Callable<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<T>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<T> out = new ArrayList<>();
            for (Future<T> f : futures) {
                out.add(f.get());
            }
            return out;
        } finally {
            pool.shutdownNow();
        }
    }
}
