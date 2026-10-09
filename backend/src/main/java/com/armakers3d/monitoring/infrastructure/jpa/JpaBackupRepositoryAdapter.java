package com.armakers3d.monitoring.infrastructure.jpa;

import com.armakers3d.monitoring.domain.BackupRecord;
import com.armakers3d.monitoring.repository.BackupRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL-backed {@link BackupRepository} over {@code respaldo_registro}; selected by {@code app.persistence.monitoring=jpa}. */
@Repository
@ConditionalOnProperty(name = "app.persistence.monitoring", havingValue = "jpa")
public class JpaBackupRepositoryAdapter implements BackupRepository {

    private final RespaldoRegistroJpaRepository jpa;

    public JpaBackupRepositoryAdapter(RespaldoRegistroJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    @Transactional
    public BackupRecord save(BackupRecord record) {
        return jpa.save(new RespaldoRegistroEntity(record)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BackupRecord> findRecent(int limit) {
        return jpa.findAllByOrderByBackupAtDescIdDesc(PageRequest.of(0, limit)).stream()
                .map(RespaldoRegistroEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BackupRecord> findLatestSuccessful() {
        return jpa.findFirstByResultOrderByBackupAtDescIdDesc(BackupRecord.Result.EXITOSO)
                .map(RespaldoRegistroEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BackupRecord> findLatestVerified() {
        return jpa.findFirstByResultAndRestoreVerifiedTrueOrderByBackupAtDescIdDesc(BackupRecord.Result.EXITOSO)
                .map(RespaldoRegistroEntity::toDomain);
    }
}
