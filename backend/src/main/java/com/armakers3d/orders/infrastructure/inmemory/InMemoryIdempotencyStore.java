package com.armakers3d.orders.infrastructure.inmemory;

import com.armakers3d.orders.repository.IdempotencyStore;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * In-memory {@link IdempotencyStore}. Thread-safe: the whole decision runs inside
 * {@link ConcurrentHashMap#compute}, which holds the entry's bin lock, so concurrent calls with the
 * same (customer, key) are serialized and exactly one runs {@code create}. Bounded: expired entries are
 * dropped and, above {@link #MAX_ENTRIES}, the entry closest to expiry is evicted (a retry of an
 * evicted key could create a second order; acceptable at academic scale, never for a DB adapter).
 * Not durable and per instance: not valid for multi-instance deployment.
 */
@Component
@ConditionalOnProperty(name = "app.persistence.orders", havingValue = "memory", matchIfMissing = true)
public class InMemoryIdempotencyStore implements IdempotencyStore {

    static final int MAX_ENTRIES = 10_000;

    private record Key(Long customerId, String key) {}

    private record Entry(String fingerprint, String orderId, Instant expiresAt) {}

    private final Map<Key, Entry> entries = new ConcurrentHashMap<>();

    @Override
    public Result executeOnce(
            Long customerId, String key, String fingerprint, Instant now, Duration ttl, Supplier<String> create) {
        shrinkIfNeeded(now);
        AtomicReference<Result> result = new AtomicReference<>();
        // The lambda touches other objects (catalog, order repository) but never this map: no re-entrancy.
        entries.compute(new Key(customerId, key), (k, existing) -> {
            if (existing != null && existing.expiresAt().isAfter(now)) {
                boolean same = existing.fingerprint().equals(fingerprint);
                result.set(new Result(same ? Outcome.REPLAYED : Outcome.MISMATCH, same ? existing.orderId() : null));
                return existing;
            }
            String orderId = create.get(); // if it throws, compute leaves the previous mapping untouched
            result.set(new Result(Outcome.CREATED, orderId));
            return new Entry(fingerprint, orderId, now.plus(ttl));
        });
        return result.get();
    }

    /** Test hook: number of remembered keys. */
    int size() {
        return entries.size();
    }

    private void shrinkIfNeeded(Instant now) {
        if (entries.size() < MAX_ENTRIES) {
            return;
        }
        entries.entrySet().removeIf(e -> !e.getValue().expiresAt().isAfter(now));
        if (entries.size() >= MAX_ENTRIES) {
            entries.entrySet().stream()
                    .min(Comparator.comparing(e -> e.getValue().expiresAt()))
                    .ifPresent(e -> entries.remove(e.getKey()));
        }
    }
}
