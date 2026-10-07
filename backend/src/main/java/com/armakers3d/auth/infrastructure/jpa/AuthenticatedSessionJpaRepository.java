package com.armakers3d.auth.infrastructure.jpa;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaAuthenticatedSessionRepositoryAdapter} (and test cleanup). */
public interface AuthenticatedSessionJpaRepository extends JpaRepository<AuthenticatedSessionEntity, String> {

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AuthenticatedSessionEntity s set s.revokedAt = :now"
            + " where s.clienteId = :clienteId and s.revokedAt is null")
    int revokeAllForCliente(@Param("clienteId") Long clienteId, @Param("now") Instant now);
}
