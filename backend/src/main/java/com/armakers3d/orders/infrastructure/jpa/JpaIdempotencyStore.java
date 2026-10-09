package com.armakers3d.orders.infrastructure.jpa;

import com.armakers3d.orders.repository.IdempotencyStore;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * PostgreSQL-backed {@link IdempotencyStore} over {@code idempotencia_pedido}. The order is created and the key stored in
 * ONE transaction: if two requests with the same key race, the loser fails on the primary key, its transaction (and the
 * order it created) rolls back, and it retries as a replay of the winner. Selected by {@code app.persistence.orders=jpa}.
 */
@Component
@ConditionalOnProperty(name = "app.persistence.orders", havingValue = "jpa")
public class JpaIdempotencyStore implements IdempotencyStore {

    private static final int MAX_ATTEMPTS = 3;

    private final IdempotenciaPedidoJpaRepository jpa;
    private final TransactionTemplate tx;

    @PersistenceContext
    private EntityManager em;

    public JpaIdempotencyStore(IdempotenciaPedidoJpaRepository jpa, PlatformTransactionManager txManager) {
        this.jpa = jpa;
        this.tx = new TransactionTemplate(txManager);
    }

    @Override
    public Result executeOnce(
            Long customerId, String key, String fingerprint, Instant now, Duration ttl, Supplier<String> create) {
        RuntimeException last = null;
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                return tx.execute(status -> attemptOnce(customerId, key, fingerprint, now, ttl, create));
            } catch (DataIntegrityViolationException | org.hibernate.exception.ConstraintViolationException raced) {
                last = raced; // lost the race on the primary key; the next attempt sees the winner's row
            }
        }
        throw last;
    }

    private Result attemptOnce(
            Long customerId, String key, String fingerprint, Instant now, Duration ttl, Supplier<String> create) {
        jpa.deleteExpiredOf(customerId, now);
        Optional<IdempotenciaPedidoEntity> existing = jpa.findById(new IdempotenciaPedidoEntity.Key(customerId, key));
        if (existing.isPresent()) {
            boolean same = existing.get().getFingerprint().equals(fingerprint);
            return new Result(
                    same ? Outcome.REPLAYED : Outcome.MISMATCH, same ? existing.get().getResourceId() : null);
        }
        String orderId = create.get(); // if it throws, the transaction rolls back and nothing is stored
        // persist, never save/merge: merge would silently overwrite the row of a concurrent winner instead of failing
        em.persist(new IdempotenciaPedidoEntity(customerId, key, fingerprint, orderId, now, now.plus(ttl)));
        em.flush();
        return new Result(Outcome.CREATED, orderId);
    }
}
