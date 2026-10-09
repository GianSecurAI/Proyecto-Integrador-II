package com.armakers3d.monitoring.repository;

import com.armakers3d.monitoring.domain.BackupRecord;
import java.util.List;
import java.util.Optional;

/** Port of the backup log. Adapters: in-memory (nodb profile and tests) and PostgreSQL (table respaldo_registro). */
public interface BackupRepository {

    /** Inserts the record (its id is null) and returns it with the assigned id. */
    BackupRecord save(BackupRecord record);

    /** The newest {@code limit} entries by backup time, newest first. */
    List<BackupRecord> findRecent(int limit);

    /** The newest successful backup, if any. */
    Optional<BackupRecord> findLatestSuccessful();

    /** The newest successful backup whose restore was verified, if any. */
    Optional<BackupRecord> findLatestVerified();
}
