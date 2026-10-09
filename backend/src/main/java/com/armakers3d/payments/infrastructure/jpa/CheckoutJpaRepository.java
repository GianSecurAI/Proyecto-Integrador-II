package com.armakers3d.payments.infrastructure.jpa;

import com.armakers3d.payments.domain.CheckoutStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaCheckoutRepositoryAdapter} (and test cleanup). */
public interface CheckoutJpaRepository extends JpaRepository<CheckoutEntity, String> {

    /** Row lock used for the compare-and-set status change. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CheckoutEntity c where c.id = :id")
    Optional<CheckoutEntity> findByIdForUpdate(@Param("id") String id);

    List<CheckoutEntity> findByStatus(CheckoutStatus status);

    List<CheckoutEntity> findByStatusAndExpiresAtLessThanEqual(CheckoutStatus status, Instant now);

    /** Open = waiting for a proof that has not expired, or a proof already submitted / rejected (still being resolved). */
    @Query("select count(c) from CheckoutEntity c where c.customerId = :customerId and"
            + " ((c.status = com.armakers3d.payments.domain.CheckoutStatus.AWAITING_PAYMENT_PROOF and c.expiresAt > :now)"
            + " or c.status in (com.armakers3d.payments.domain.CheckoutStatus.PROOF_SUBMITTED,"
            + " com.armakers3d.payments.domain.CheckoutStatus.PROOF_REJECTED))")
    long countOpenOf(@Param("customerId") Long customerId, @Param("now") Instant now);

    @Query("select distinct c.id from CheckoutEntity c join c.attempts a where a.sha256 = :sha256")
    List<String> findIdsByProofHash(@Param("sha256") String sha256);
}
