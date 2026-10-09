package com.armakers3d.orders.infrastructure.jpa;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaOrderRepositoryAdapter} (and test cleanup). */
public interface PedidoJpaRepository extends JpaRepository<PedidoEntity, Long> {

    Optional<PedidoEntity> findByCode(String code);

    Optional<PedidoEntity> findByCheckoutId(String checkoutId);

    boolean existsByCheckoutId(String checkoutId);

    List<PedidoEntity> findByCustomerIdOrderByCreatedAtDescCodeDesc(Long customerId);

    /** Row lock used for the compare-and-set status change: concurrent updates of one order queue behind each other. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PedidoEntity p where p.code = :code")
    Optional<PedidoEntity> findByCodeForUpdate(@Param("code") String code);
}
