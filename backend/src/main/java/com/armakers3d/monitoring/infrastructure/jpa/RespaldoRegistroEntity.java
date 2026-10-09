package com.armakers3d.monitoring.infrastructure.jpa;

import com.armakers3d.monitoring.domain.BackupRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** JPA mapping of table {@code respaldo_registro} (V10). Infrastructure only. */
@Entity
@Table(name = "respaldo_registro")
public class RespaldoRegistroEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_respaldo")
    private Long id;

    @Column(name = "fecha_respaldo", nullable = false)
    private Instant backupAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private BackupRecord.Type type;

    @Enumerated(EnumType.STRING)
    @Column(name = "resultado", nullable = false, length = 20)
    private BackupRecord.Result result;

    @Column(name = "restauracion_verificada", nullable = false)
    private boolean restoreVerified;

    @Column(name = "detalle", length = 500)
    private String detail;

    @Column(name = "id_usuario_registro", nullable = false)
    private Long registeredBy;

    @Column(name = "fecha_registro", nullable = false)
    private Instant registeredAt;

    protected RespaldoRegistroEntity() {
    }

    RespaldoRegistroEntity(BackupRecord r) {
        this.backupAt = r.backupAt();
        this.type = r.type();
        this.result = r.result();
        this.restoreVerified = r.restoreVerified();
        this.detail = r.detail();
        this.registeredBy = r.registeredBy();
        this.registeredAt = r.registeredAt();
    }

    BackupRecord toDomain() {
        return new BackupRecord(id, backupAt, type, result, restoreVerified, detail, registeredBy, registeredAt);
    }
}
