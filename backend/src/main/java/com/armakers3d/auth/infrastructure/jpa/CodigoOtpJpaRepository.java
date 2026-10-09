package com.armakers3d.auth.infrastructure.jpa;

import com.armakers3d.auth.domain.CodigoOtpStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaCodigoOtpRepositoryAdapter} (and test cleanup). */
public interface CodigoOtpJpaRepository extends JpaRepository<CodigoOtpEntity, Long> {

    /** Ordered by id as the tie-breaker so two codes issued in the same instant stay ordered. */
    Optional<CodigoOtpEntity> findFirstByEmailOrderByIssuedAtDescIdDesc(String email);

    List<CodigoOtpEntity> findAllByEmailAndStatus(String email, CodigoOtpStatus status);

    long countByEmailAndIssuedAtAfter(String email, Instant since);

    @Query("select coalesce(sum(case when c.status = com.armakers3d.auth.domain.CodigoOtpStatus.VERIFIED"
            + " then c.attemptCount - 1 else c.attemptCount end), 0) from CodigoOtpEntity c"
            + " where c.email = :email and c.issuedAt > :since")
    long sumFailedAttemptsIssuedAfter(@Param("email") String email, @Param("since") Instant since);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CodigoOtpEntity c set c.attemptCount = c.attemptCount + 1 where c.id = :id")
    int incrementAttemptCount(@Param("id") Long id);

    @Query("select c.attemptCount from CodigoOtpEntity c where c.id = :id")
    Optional<Integer> findAttemptCount(@Param("id") Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CodigoOtpEntity c set c.status = com.armakers3d.auth.domain.CodigoOtpStatus.VERIFIED,"
            + " c.usedAt = :now, c.utilizado = true where c.id = :id and c.status = com.armakers3d.auth.domain.CodigoOtpStatus.PENDING")
    int markVerifiedIfPending(@Param("id") Long id, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from CodigoOtpEntity c where c.issuedAt < :cutoff")
    int deleteIssuedBefore(@Param("cutoff") Instant cutoff);
}
