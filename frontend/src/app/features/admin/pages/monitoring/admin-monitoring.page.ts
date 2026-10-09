import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminSummaryCardComponent } from '../../components/admin-summary-card/admin-summary-card.component';
import {
  BACKUP_HEALTH_META,
  BackupOverview,
  BackupResult,
  BackupType,
  SystemStatus,
} from '../../models/admin-monitoring.model';
import { AdminMonitoringService } from '../../services/admin-monitoring.service';
import { apiErrorCode, httpStatus, rateLimitMessage } from '../../../../core/models/api-error.model';

type LoadStatus = 'loading' | 'loaded' | 'error';

const PERSISTENCE_LABELS: Record<string, string> = {
  users: 'Usuarios',
  catalog: 'Catálogo',
  orders: 'Pedidos',
  incidents: 'Incidencias',
  payments: 'Pagos',
  proofs: 'Comprobantes',
  quotations: 'Cotizaciones',
  monitoring: 'Respaldos',
};

const JOB_LABELS: Record<string, string> = {
  otpAndSessionPurge: 'Limpieza de códigos y sesiones',
  checkoutExpiry: 'Vencimiento de compras sin comprobante',
};

/** Local time as the `yyyy-MM-ddTHH:mm` value a `datetime-local` input expects. */
function nowLocalInputValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/**
 * System status and backup log (`/admin/monitoring`, RESPONSABLE_TI and ADMINISTRADOR), RF-18 / RNF10 / RNF11:
 * availability of the API and the database, a few operational counters, and the log of the backups of the managed
 * database with the restore tests that verified them. The IT officer registers each backup or restore test here.
 */
@Component({
  selector: 'app-admin-monitoring-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    AdminSummaryCardComponent,
    AdminDataTableComponent,
    ButtonComponent,
    CardComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-monitoring.page.html',
  styleUrl: './admin-monitoring.page.scss',
})
export class AdminMonitoringPage {
  private readonly monitoring = inject(AdminMonitoringService);

  readonly status = signal<LoadStatus>('loading');
  readonly system = signal<SystemStatus | null>(null);
  readonly backups = signal<BackupOverview | null>(null);

  // register-backup form
  readonly formAt = signal(nowLocalInputValue());
  readonly formType = signal<BackupType>('AUTOMATICO');
  readonly formResult = signal<BackupResult>('EXITOSO');
  readonly formVerified = signal(false);
  readonly formDetail = signal('');
  readonly saving = signal(false);
  readonly saveMessage = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  readonly healthMeta = BACKUP_HEALTH_META;
  private request: Subscription | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  retry(): void {
    this.load();
  }

  persistenceRows(system: SystemStatus): { label: string; value: string }[] {
    return Object.entries(system.persistence).map(([key, value]) => ({
      label: PERSISTENCE_LABELS[key] ?? key,
      value: value === 'jpa' ? 'PostgreSQL' : 'Memoria (solo pruebas)',
    }));
  }

  jobRows(system: SystemStatus): { label: string; enabled: boolean }[] {
    return Object.entries(system.scheduledJobs).map(([key, enabled]) => ({
      label: JOB_LABELS[key] ?? key,
      enabled,
    }));
  }

  uptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days > 0 ? `${days} d ${hours} h` : hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  }

  formatDate(iso: string | null): string {
    return iso ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';
  }

  setVerified(checked: boolean): void {
    this.formVerified.set(checked);
  }

  setResult(value: string): void {
    this.formResult.set(value as BackupResult);
    if (value === 'FALLIDO') this.formVerified.set(false);
  }

  registerBackup(): void {
    if (this.saving() || !this.formAt()) return;
    this.saving.set(true);
    this.saveMessage.set(null);
    this.monitoring
      .registerBackup({
        backupAt: new Date(this.formAt()).toISOString(),
        type: this.formType(),
        result: this.formResult(),
        restoreVerified: this.formVerified(),
        detail: this.formDetail().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saveMessage.set({ kind: 'ok', text: 'Respaldo registrado.' });
          this.formDetail.set('');
          this.formVerified.set(false);
          this.load(false);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const text =
            httpStatus(err) === 429
              ? rateLimitMessage(err)
              : apiErrorCode(err) === 'VALIDATION_FAILED'
                ? 'El servidor rechazó los datos: revisa la fecha (no puede ser futura) y que solo un respaldo exitoso tenga la restauración verificada.'
                : 'No pudimos registrar el respaldo. Inténtalo de nuevo.';
          this.saveMessage.set({ kind: 'error', text });
        },
      });
  }

  private load(showSpinner = true): void {
    this.request?.unsubscribe();
    if (showSpinner) this.status.set('loading');
    this.request = forkJoin([this.monitoring.status(), this.monitoring.backups()]).subscribe({
      next: ([system, backups]) => {
        this.system.set(system);
        this.backups.set(backups);
        this.status.set('loaded');
      },
      error: () => this.status.set('error'),
    });
  }
}
