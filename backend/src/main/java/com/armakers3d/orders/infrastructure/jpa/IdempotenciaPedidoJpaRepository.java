package com.armakers3d.orders.infrastructure.jpa;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaIdempotencyStore}. */
public interface IdempotenciaPedidoJpaRepository
        extends JpaRepository<IdempotenciaPedidoEntity, IdempotenciaPedidoEntity.Key> {

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from IdempotenciaPedidoEntity e where e.customerId = :customerId and e.expiresAt <= :now")
    int deleteExpiredOf(@Param("customerId") Long customerId, @Param("now") Instant now);
}
