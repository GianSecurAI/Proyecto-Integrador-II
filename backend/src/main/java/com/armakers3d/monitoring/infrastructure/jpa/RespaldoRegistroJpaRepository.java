package com.armakers3d.monitoring.infrastructure.jpa;

import com.armakers3d.monitoring.domain.BackupRecord;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data interface used only by {@link JpaBackupRepositoryAdapter} (and test cleanup). */
public interface RespaldoRegistroJpaRepository extends JpaRepository<RespaldoRegistroEntity, Long> {

    List<RespaldoRegistroEntity> findAllByOrderByBackupAtDescIdDesc(Pageable pageable);

    Optional<RespaldoRegistroEntity> findFirstByResultOrderByBackupAtDescIdDesc(BackupRecord.Result result);

    Optional<RespaldoRegistroEntity> findFirstByResultAndRestoreVerifiedTrueOrderByBackupAtDescIdDesc(
            BackupRecord.Result result);
}
