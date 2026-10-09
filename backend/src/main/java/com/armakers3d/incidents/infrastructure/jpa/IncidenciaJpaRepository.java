package com.armakers3d.incidents.infrastructure.jpa;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data interface used only by {@link JpaIncidentRepositoryAdapter} (and test cleanup). */
public interface IncidenciaJpaRepository extends JpaRepository<IncidenciaEntity, Long> {

    Optional<IncidenciaEntity> findByCode(String code);

    @Query("select i from IncidenciaEntity i where i.order.code = :orderCode and i.statusId not in :terminalStatusIds")
    List<IncidenciaEntity> findOpenByOrderCode(
            @Param("orderCode") String orderCode, @Param("terminalStatusIds") List<Long> terminalStatusIds);

    /** Row lock used for the compare-and-set update: concurrent updates of one incident queue behind each other. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from IncidenciaEntity i where i.code = :code")
    Optional<IncidenciaEntity> findByCodeForUpdate(@Param("code") String code);
}
