package com.armakers3d.monitoring.domain;

import java.time.Instant;

/**
 * One entry of the backup log of the managed database (RNF10, RF18): when a backup was taken, whether it succeeded,
 * and whether a restore test proved it can actually be recovered (section 6.2.3 of the project document).
 * {@code id} is null until stored.
 */
public record BackupRecord(
        Long id,
        Instant backupAt,
        Type type,
        Result result,
        boolean restoreVerified,
        String detail,
        Long registeredBy,
        Instant registeredAt) {

    public enum Type {
        AUTOMATICO,
        MANUAL
    }

    public enum Result {
        EXITOSO,
        FALLIDO
    }

    public BackupRecord withId(Long newId) {
        return new BackupRecord(newId, backupAt, type, result, restoreVerified, detail, registeredBy, registeredAt);
    }
}
