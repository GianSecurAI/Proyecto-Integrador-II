import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import {
  INCIDENT_STATUSES,
  IncidentPriority,
  IncidentStatus,
  ORDER_STATUSES,
  OrderStatus,
  describeIncidentPriority,
  describeIncidentStatus,
  describeOrderStatus,
} from '../../../../shared/models/wire-enums';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminSummaryCardComponent } from '../../components/admin-summary-card/admin-summary-card.component';
import {
  IncidentReportDto,
  OrderReportDto,
  REPORT_MAX_DAYS,
} from '../../models/admin-report.model';
import { AdminReportsService } from '../../services/admin-reports.service';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type OrderStatusFilter = OrderStatus | 'todos';
type IncidentStatusFilter = IncidentStatus | 'todos';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

/** Calendar day (`YYYY-MM-DD`) in the business time zone (America/Lima), the zone the backend
 * uses to interpret `from`/`to`. */
function limaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Staff reports screen (`/admin/reports`), RF-19, ADMINISTRADOR only (the route guard is UX; the
 * backend answers 403 to ASESOR). The page sends EXPLICIT `from`/`to` dates (default: the last 30
 * days in America/Lima) plus optional status filters to `GET /api/admin/reports/orders` and
 * `/incidents`, and renders the counts and amounts the server returns — it computes nothing.
 *
 * Client validation (from <= to, at most 366 days) mirrors the backend rule for UX only; the
 * server answers `400 VALIDATION_FAILED` otherwise and that message is shown. There is no export
 * and no row listing (PD-REP-01/06). Amounts are committed order value excluding cancelled orders,
 * NOT collected revenue (PD-REP-03) — the screen says so.
 */
@Component({
  selector: 'app-admin-reports-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    AdminDataTableComponent,
    AdminSummaryCardComponent,
    ButtonComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-reports.page.html',
  styleUrl: './admin-reports.page.scss',
})
export class AdminReportsPage {
  private readonly reports = inject(AdminReportsService);

  readonly status = signal<LoadStatus>('idle');
  readonly orderReport = signal<OrderReportDto | null>(null);
  readonly incidentReport = signal<IncidentReportDto | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly startDate = signal(limaDay(new Date(Date.now() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS)));
  readonly endDate = signal(limaDay(new Date()));
  readonly orderStatusFilter = signal<OrderStatusFilter>('todos');
  readonly incidentStatusFilter = signal<IncidentStatusFilter>('todos');

  readonly orderStatusFilterOptions: readonly OrderStatusFilter[] = ['todos', ...ORDER_STATUSES];
  readonly incidentStatusFilterOptions: readonly IncidentStatusFilter[] = [
    'todos',
    ...INCIDENT_STATUSES,
  ];

  /** UX-only validation message for the date range (the server re-validates). */
  readonly rangeError = computed<string | null>(() => {
    const from = this.startDate();
    const to = this.endDate();
    if (!from || !to) return 'Ingresa la fecha desde y la fecha hasta.';
    if (from > to) return 'La fecha desde no puede ser posterior a la fecha hasta.';
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;
    if (days > REPORT_MAX_DAYS) return `El rango máximo es de ${REPORT_MAX_DAYS} días.`;
    return null;
  });

  readonly orderRows = computed(() =>
    (this.orderReport()?.byStatus ?? []).map((row) => ({
      key: row.status,
      count: row.count,
      ...describeOrderStatus(row.status),
    })),
  );
  readonly incidentStatusRows = computed(() =>
    (this.incidentReport()?.byStatus ?? []).map((row) => ({
      key: row.status,
      count: row.count,
      ...describeIncidentStatus(row.status),
    })),
  );
  readonly incidentPriorityRows = computed(() =>
    (this.incidentReport()?.byPriority ?? []).map((row) => ({
      key: row.priority as IncidentPriority,
      count: row.count,
      ...describeIncidentPriority(row.priority),
    })),
  );

  private request: Subscription | null = null;

  constructor() {
    this.generate();
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  updateStartDate(value: string): void {
    this.startDate.set(value);
  }

  updateEndDate(value: string): void {
    this.endDate.set(value);
  }

  updateOrderStatusFilter(value: string): void {
    this.orderStatusFilter.set(value as OrderStatusFilter);
  }

  updateIncidentStatusFilter(value: string): void {
    this.incidentStatusFilter.set(value as IncidentStatusFilter);
  }

  orderStatusLabel(status: OrderStatus): string {
    return describeOrderStatus(status).label;
  }

  incidentStatusLabel(status: IncidentStatus): string {
    return describeIncidentStatus(status).label;
  }

  /** Requests both reports for the selected range/filters. */
  generate(): void {
    if (this.rangeError()) return;
    this.request?.unsubscribe();
    this.status.set('loading');
    this.errorMessage.set(null);
    const orderStatus = this.orderStatusFilter();
    const incidentStatus = this.incidentStatusFilter();
    this.request = forkJoin([
      this.reports.orders(this.startDate(), this.endDate(), orderStatus === 'todos' ? null : orderStatus),
      this.reports.incidents(
        this.startDate(),
        this.endDate(),
        incidentStatus === 'todos' ? null : incidentStatus,
      ),
    ]).subscribe({
      next: ([orders, incidents]) => {
        this.orderReport.set(orders);
        this.incidentReport.set(incidents);
        this.status.set('loaded');
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.messageFor(err));
        this.status.set('error');
      },
    });
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 400) return 'El servidor rechazó el rango de fechas. Revisa las fechas e inténtalo de nuevo.';
    return 'Ocurrió un problema al generar el reporte. Inténtalo de nuevo.';
  }
}
