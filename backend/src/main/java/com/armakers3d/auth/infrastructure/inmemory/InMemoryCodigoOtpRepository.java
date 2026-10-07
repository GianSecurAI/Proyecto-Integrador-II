package com.armakers3d.auth.infrastructure.inmemory;

import com.armakers3d.auth.domain.CodigoOtp;
import com.armakers3d.auth.domain.CodigoOtpStatus;
import com.armakers3d.auth.repository.CodigoOtpRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link CodigoOtpRepository} for the {@code nodb} profile only. Stored rows are never
 * handed out (copies in, copies out). The two atomic operations use
 * {@link ConcurrentHashMap#compute}, so they are race-free exactly like their single-statement
 * SQL counterparts in the JPA adapter.
 */
@Repository
@Profile("nodb")
public class InMemoryCodigoOtpRepository implements CodigoOtpRepository {

    private static final Comparator<CodigoOtp> NEWEST_FIRST =
            Comparator.comparing(CodigoOtp::getIssuedAt).thenComparing(CodigoOtp::getId).reversed();

    private final Map<Long, CodigoOtp> byId = new ConcurrentHashMap<>();
    private final AtomicLong ids = new AtomicLong();

    @Override
    public CodigoOtp save(CodigoOtp c) {
        long id = c.getId() != null ? c.getId() : ids.incrementAndGet();
        CodigoOtp stored = withId(c, id, c.getAttemptCount(), c.getStatus(), c.getUsedAt());
        byId.put(id, stored);
        return copy(stored);
    }

    @Override
    public Optional<CodigoOtp> findLatestByEmail(String email) {
        return byId.values().stream()
                .filter(c -> c.getEmail().equals(email))
                .min(NEWEST_FIRST)
                .map(InMemoryCodigoOtpRepository::copy);
    }

    @Override
    public List<CodigoOtp> findByEmailAndStatus(String email, CodigoOtpStatus status) {
        return byId.values().stream()
                .filter(c -> c.getEmail().equals(email) && c.getStatus() == status)
                .map(InMemoryCodigoOtpRepository::copy)
                .toList();
    }

    @Override
    public long countIssuedAfter(String email, Instant since) {
        return byId.values().stream()
                .filter(c -> c.getEmail().equals(email) && c.getIssuedAt().isAfter(since))
                .count();
    }

    @Override
    public long sumFailedAttemptsIssuedAfter(String email, Instant since) {
        return byId.values().stream()
                .filter(c -> c.getEmail().equals(email) && c.getIssuedAt().isAfter(since))
                .mapToLong(c -> c.getStatus() == CodigoOtpStatus.VERIFIED
                        ? Math.max(0, c.getAttemptCount() - 1)
                        : c.getAttemptCount())
                .sum();
    }

    @Override
    public int incrementAttemptCount(Long id) {
        CodigoOtp updated =
                byId.computeIfPresent(
                        id, (k, c) -> withId(c, c.getId(), c.getAttemptCount() + 1, c.getStatus(), c.getUsedAt()));
        if (updated == null) {
            throw new IllegalStateException("No such code: " + id);
        }
        return updated.getAttemptCount();
    }

    @Override
    public boolean markVerifiedIfPending(Long id, Instant now) {
        AtomicBoolean changed = new AtomicBoolean(false);
        byId.computeIfPresent(
                id,
                (k, c) -> {
                    if (c.getStatus() != CodigoOtpStatus.PENDING) {
                        return c;
                    }
                    changed.set(true);
                    return withId(c, c.getId(), c.getAttemptCount(), CodigoOtpStatus.VERIFIED, now);
                });
        return changed.get();
    }

    /** Test/dev helper; not part of the port. */
    public void clear() {
        byId.clear();
    }

    private static CodigoOtp copy(CodigoOtp c) {
        return withId(c, c.getId(), c.getAttemptCount(), c.getStatus(), c.getUsedAt());
    }

    private static CodigoOtp withId(CodigoOtp c, Long id, int attempts, CodigoOtpStatus status, Instant usedAt) {
        return new CodigoOtp(id, c.getEmail(), c.getCodeHash(), c.getIssuedAt(), c.getExpiresAt(), usedAt, attempts, status);
    }
}
