package com.armakers3d.monitoring.infrastructure.inmemory;

import com.armakers3d.monitoring.domain.BackupRecord;
import com.armakers3d.monitoring.repository.BackupRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

/** In-memory {@link BackupRepository}; NOT durable. Selected by {@code app.persistence.monitoring=memory}. */
@Repository
@ConditionalOnProperty(name = "app.persistence.monitoring", havingValue = "memory", matchIfMissing = true)
public class InMemoryBackupRepository implements BackupRepository {

    private static final Comparator<BackupRecord> NEWEST_FIRST =
            Comparator.comparing(BackupRecord::backupAt).thenComparing(BackupRecord::id).reversed();

    private final List<BackupRecord> records = new ArrayList<>();
    private long sequence;

    @Override
    public synchronized BackupRecord save(BackupRecord record) {
        BackupRecord stored = record.withId(++sequence);
        records.add(stored);
        return stored;
    }

    @Override
    public synchronized List<BackupRecord> findRecent(int limit) {
        return records.stream().sorted(NEWEST_FIRST).limit(limit).toList();
    }

    @Override
    public synchronized Optional<BackupRecord> findLatestSuccessful() {
        return records.stream().filter(r -> r.result() == BackupRecord.Result.EXITOSO).min(NEWEST_FIRST);
    }

    @Override
    public synchronized Optional<BackupRecord> findLatestVerified() {
        return records.stream()
                .filter(r -> r.result() == BackupRecord.Result.EXITOSO && r.restoreVerified())
                .min(NEWEST_FIRST);
    }
}
