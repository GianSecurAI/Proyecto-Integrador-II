/** Backend `MonitoringService.SystemStatus` (`GET /api/admin/monitoring`): operational data, no personal data. */
export interface SystemStatus {
  status: 'UP' | 'DOWN';
  checkedAt: string;
  startedAt: string;
  uptimeSeconds: number;
  javaVersion: string;
  processors: number;
  memory: { usedMb: number; maxMb: number };
  database: {
    available: boolean;
    latencyMs: number | null;
    product: string | null;
    version: string | null;
    schemaVersion: string | null;
  };
  /** Null when the database is not available. */
  counters: {
    users: number;
    activeProducts: number;
    orders: number;
    openIncidents: number;
    paymentsToReview: number;
    pendingQuotations: number;
  } | null;
  persistence: Record<string, string>;
  scheduledJobs: Record<string, boolean>;
}

export type BackupType = 'AUTOMATICO' | 'MANUAL';
export type BackupResult = 'EXITOSO' | 'FALLIDO';
export type BackupHealth = 'OK' | 'WARNING' | 'CRITICAL';

/** One entry of the backup log (`respaldo_registro`). */
export interface BackupRecord {
  id: number;
  backupAt: string;
  type: BackupType;
  result: BackupResult;
  restoreVerified: boolean;
  detail: string | null;
  registeredBy: number;
  registeredAt: string;
}

export interface BackupOverview {
  health: BackupHealth;
  maxAgeHours: number;
  lastSuccessfulAt: string | null;
  hoursSinceLastSuccess: number | null;
  lastVerifiedRestoreAt: string | null;
  recent: BackupRecord[];
}

export interface RegisterBackupRequest {
  backupAt: string;
  type: BackupType;
  result: BackupResult;
  restoreVerified: boolean;
  detail?: string;
}

export const BACKUP_HEALTH_META: Record<
  BackupHealth,
  { label: string; tone: 'success' | 'info' | 'danger'; description: string }
> = {
  OK: { label: 'Al día', tone: 'success', description: 'Hay un respaldo exitoso reciente.' },
  WARNING: {
    label: 'Atrasado',
    tone: 'info',
    description: 'El último respaldo exitoso es más antiguo que el máximo permitido.',
  },
  CRITICAL: { label: 'Sin respaldos', tone: 'danger', description: 'No hay ningún respaldo exitoso registrado.' },
};
