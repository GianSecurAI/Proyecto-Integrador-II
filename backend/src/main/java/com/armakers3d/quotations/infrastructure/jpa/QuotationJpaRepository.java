package com.armakers3d.quotations.infrastructure.jpa;

import com.armakers3d.shared.persistence.CotizacionEntity;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaQuotationRepositoryAdapter} (and test cleanup). */
public interface QuotationJpaRepository extends JpaRepository<CotizacionEntity, Long> {

    /** Row lock used for the compare-and-set status change. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CotizacionEntity c where c.id = :id")
    Optional<CotizacionEntity> findByIdForUpdate(@Param("id") Long id);

    interface StatusTotals {
        String getStatus();

        Long getTotal();

        BigDecimal getAmount();
    }

    @Query("select c.status as status, count(c) as total, coalesce(sum(c.agreedAmount), 0) as amount"
            + " from CotizacionEntity c where c.quotedAt >= :from and c.quotedAt < :to group by c.status")
    List<StatusTotals> totalsByStatus(@Param("from") Instant from, @Param("to") Instant to);
}
