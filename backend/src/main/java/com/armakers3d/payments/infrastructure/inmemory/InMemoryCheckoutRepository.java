package com.armakers3d.payments.infrastructure.inmemory;

import com.armakers3d.payments.domain.Checkout;
import com.armakers3d.payments.domain.CheckoutStatus;
import com.armakers3d.payments.repository.CheckoutRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/**
 * In-memory {@link CheckoutRepository}. NOT durable and per instance: selected by
 * {@code app.persistence.payments=memory}; {@code InMemoryStorageGuard} refuses to boot it outside
 * local/nodb/test. All operations are synchronized on the instance (small data set, dev/test only), which makes
 * the per-customer open cap and the compare-and-set trivially atomic. Checkouts are immutable records.
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.payments", havingValue = "memory", matchIfMissing = true)
public class InMemoryCheckoutRepository implements CheckoutRepository {

    private final Map<String, Checkout> byId = new HashMap<>();

    @Override
    public synchronized Optional<Checkout> findById(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public synchronized boolean insertIfOpenBelow(Checkout checkout, int maxOpen, Instant now) {
        long open = byId.values().stream()
                .filter(c -> c.customerId().equals(checkout.customerId()) && c.isOpen(now))
                .count();
        if (open >= maxOpen) {
            return false;
        }
        byId.put(checkout.id(), checkout);
        return true;
    }

    @Override
    public synchronized boolean replaceIfStatus(Checkout updated, CheckoutStatus expected) {
        Checkout current = byId.get(updated.id());
        if (current == null || current.status() != expected) {
            return false;
        }
        byId.put(updated.id(), updated);
        return true;
    }

    @Override
    public synchronized List<Checkout> findAwaitingProofExpiredAt(Instant now) {
        return byId.values().stream().filter(c -> c.isPastExpiry(now)).toList();
    }

    @Override
    public synchronized List<Checkout> findByStatus(CheckoutStatus status) {
        return byId.values().stream().filter(c -> c.status() == status).toList();
    }

    @Override
    public synchronized Set<String> findCheckoutIdsByProofHash(String sha256) {
        return byId.values().stream()
                .filter(c -> c.attempts().stream().anyMatch(a -> a.sha256().equals(sha256)))
                .map(Checkout::id)
                .collect(Collectors.toSet());
    }
}
