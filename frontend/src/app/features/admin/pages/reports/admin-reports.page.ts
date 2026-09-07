import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminSummaryCardComponent } from '../../components/admin-summary-card/admin-summary-card.component';
import { AdminOrderSummaryViewModel } from '../../models/admin-order.model';
import {
  AdminIncidentViewModel,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  IncidentPriority,
  describeIncidentPriority,
} from '../../models/admin-incident.model';
import { AdminOrdersMockService, AdminOrdersMockState } from '../../services/admin-orders-mock.service';
import {
  AdminIncidentsMockService,
  AdminIncidentsMockState,
} from '../../services/admin-incidents-mock.service';
import { OrderStatus, describeOrderStatus } from '../../../account/models/order.model';
import { IncidentStatus, describeIncidentStatus } from '../../../account/models/incident.model';

type LoadStatus = 'loading' | 'loaded' | 'error';
type MockState = 'populated' | 'empty' | 'error';
type OrderStatusFilter = OrderStatus | 'todos';
type IncidentStatusFilter = IncidentStatus | 'todos';

/** Every `OrderStatus`, in the same order as `ORDER_STATUS_TRANSITIONS`
 * (`../../models/admin-order.model.ts`) — used only to render a complete status-breakdown table
 * (every status shown, including a zero count), not to enforce any transition rule here. */
const ORDER_STATUSES: readonly OrderStatus[] = [
  'pendiente',
  'confirmado',
  'en_produccion',
  'enviado',
  'entregado',
  'cancelado',
];

const ORDER_STATUS_FILTER_OPTIONS: readonly OrderStatusFilter[] = ['todos', ...ORDER_STATUSES];
const INCIDENT_STATUS_FILTER_OPTIONS: readonly IncidentStatusFilter[] = [
  'todos',
  ...INCIDENT_STATUSES,
];

interface StatusCount<S extends string> {
  readonly status: S;
  readonly label: string;
  readonly tone: 'neutral' | 'info' | 'success' | 'danger';
  readonly count: number;
}

interface PriorityCount {
  readonly priority: IncidentPriority;
  readonly label: string;
  readonly tone: 'neutral' | 'info' | 'success' | 'danger';
  readonly count: number;
}

/**
 * Staff reports screen (`/admin/reports`) — RF-19 ("Generación de reportes de pedidos/
 * cotizaciones/incidencias"), actor Administrador ONLY
 * (`docs/discovery/06-system-definition.md` line 99: "Los reportes son de acceso exclusivo del rol
 * Administrador" — the route's own `canActivate`/`data: { role: 'ADMINISTRADOR' }` guard,
 * untouched by this task, already enforces this). Figma has ZERO relevant frames for reports
 * (grepped for "reporte"/"chart"/"gráfico"/"dashboard", zero real matches; line 263 independently
 * confirms "No existe pantalla"), so this screen reuses the existing admin design system
 * (`AdminDataTableComponent`, the new `AdminSummaryCardComponent`) per Constitution Principle XV.
 * No chart library is used or added — nothing in Figma requires one, and RF-19's own scope
 * (line 210) leaves exact content "Pendiente de definir" beyond the one mandated date-range
 * filter (line 330).
 *
 * `Reporte` is NOT a persisted entity (line 145: "es una agregación de solo lectura sobre
 * Pedido/Cotizacion/Incidencia, parametrizada por filtros en el momento de la consulta") — this
 * page therefore injects the ALREADY-EXISTING `AdminOrdersMockService`/`AdminIncidentsMockService`
 * directly and aggregates client-side via computed signals; it never introduces a third, parallel
 * "reports" mock fixture.
 *
 * QUOTATIONS: no dedicated `Cotizacion` model/mock exists anywhere in this codebase yet. Per
 * RF-10/RF-11's documented relationship (line 158: "Cotizacion 0..1---1 Pedido"), every
 * `personalizado`-kind order registered by `AdminOrdersMockService.registerPersonalizedOrder()`
 * corresponds to exactly one quotation, so the "Cotizaciones" section below derives its count/list
 * from `personalizado`-kind orders — never a new entity. This section is deliberately
 * COUNT/LIST-based only, never sum-based: `registerPersonalizedOrder()`'s quotation amount is only
 * embedded as prose inside `statusHistory[0].note` ("monto acordado: S/ X.XX"), not a structured
 * field, so parsing/summing it here would be fragile and is a documented limitation pending a real
 * `Cotizacion` model with a structured amount field.
 *
 * FILTERS: the one RF-19-mandated minimum (line 330) is a date-range filter, applied to
 * `placedAt` (orders/quotations) / `reportedAt` (incidents) before any aggregation. Beyond that,
 * this page offers exactly TWO status filters — "Estado del pedido" (`OrderStatus`, shared by the
 * Pedidos AND Cotizaciones sections, since a quotation IS a `personalizado`-kind order and carries
 * the same `OrderStatus` vocabulary — reusing `describeOrderStatus`, never a third parallel
 * vocabulary) and "Estado de la incidencia" (`IncidentStatus`, Incidencias section only, reusing
 * `describeIncidentStatus`). No export button and no predictive/trend language anywhere — both
 * are out of scope per RF-19's own undefined-format open question and this task's brief.
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
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-reports.page.html',
  styleUrl: './admin-reports.page.scss',
})
export class AdminReportsPage {
  private readonly ordersService = inject(AdminOrdersMockService);
  private readonly incidentsService = inject(AdminIncidentsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly orders = signal<AdminOrderSummaryViewModel[]>([]);
  readonly incidents = signal<AdminIncidentViewModel[]>([]);

  /** Date-range bounds as plain `<input type="date">` strings (`YYYY-MM-DD`) or `null` when
   * unset — an unset bound means "no lower/upper limit", per RF-19's one mandated filter. */
  readonly startDate = signal<string | null>(null);
  readonly endDate = signal<string | null>(null);

  readonly orderStatusFilter = signal<OrderStatusFilter>('todos');
  readonly incidentStatusFilter = signal<IncidentStatusFilter>('todos');

  readonly orderStatusFilterOptions = ORDER_STATUS_FILTER_OPTIONS;
  readonly incidentStatusFilterOptions = INCIDENT_STATUS_FILTER_OPTIONS;

  private currentMockState: MockState = 'populated';

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  private readonly parsedStart = computed(() => {
    const value = this.startDate();
    return value ? new Date(`${value}T00:00:00`) : null;
  });

  private readonly parsedEnd = computed(() => {
    const value = this.endDate();
    return value ? new Date(`${value}T23:59:59.999`) : null;
  });

  /** Orders narrowed by the date range only (against `placedAt`) — the shared base both the
   * Pedidos and Cotizaciones sections further narrow by `orderStatusFilter`. */
  private readonly ordersInRange = computed(() =>
    this.orders().filter((order) => this.inRange(order.placedAt)),
  );

  /** Orders narrowed by date range AND the shared order-status filter — feeds both the Pedidos
   * summary cards/table and (further narrowed to `personalizado`) the Cotizaciones section. */
  readonly ordersFiltered = computed(() => {
    const status = this.orderStatusFilter();
    return this.ordersInRange().filter((order) => status === 'todos' || order.status === status);
  });

  readonly totalOrders = computed(() => this.ordersFiltered().length);
  readonly standardOrdersCount = computed(
    () => this.ordersFiltered().filter((order) => order.kind === 'estandar').length,
  );

  /** Cotizaciones — see this class's doc comment for why `personalizado`-kind orders ARE the
   * quotation data source (no separate `Cotizacion` entity exists). */
  readonly quotations = computed(() =>
    this.ordersFiltered().filter((order) => order.kind === 'personalizado'),
  );

  readonly ordersByStatus = computed<StatusCount<OrderStatus>[]>(() => {
    const counts = new Map<OrderStatus, number>(ORDER_STATUSES.map((status) => [status, 0]));
    for (const order of this.ordersFiltered()) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    return ORDER_STATUSES.map((status) => {
      const { label, tone } = describeOrderStatus(status);
      return { status, label, tone, count: counts.get(status) ?? 0 };
    });
  });

  private readonly incidentsInRange = computed(() =>
    this.incidents().filter((incident) => this.inRange(incident.reportedAt)),
  );

  readonly incidentsFiltered = computed(() => {
    const status = this.incidentStatusFilter();
    return this.incidentsInRange().filter(
      (incident) => status === 'todos' || incident.status === status,
    );
  });

  readonly totalIncidents = computed(() => this.incidentsFiltered().length);
  readonly openIncidentsCount = computed(
    () =>
      this.incidentsFiltered().filter(
        (incident) => incident.status === 'abierta' || incident.status === 'en_revision',
      ).length,
  );
  readonly resolvedIncidentsCount = computed(
    () => this.incidentsFiltered().filter((incident) => incident.status === 'resuelta').length,
  );

  readonly incidentsByStatus = computed<StatusCount<IncidentStatus>[]>(() => {
    const counts = new Map<IncidentStatus, number>(INCIDENT_STATUSES.map((status) => [status, 0]));
    for (const incident of this.incidentsFiltered()) {
      counts.set(incident.status, (counts.get(incident.status) ?? 0) + 1);
    }
    return INCIDENT_STATUSES.map((status) => {
      const { label, tone } = describeIncidentStatus(status);
      return { status, label, tone, count: counts.get(status) ?? 0 };
    });
  });

  readonly incidentsByPriority = computed<PriorityCount[]>(() => {
    const counts = new Map<IncidentPriority, number>(
      INCIDENT_PRIORITIES.map((priority) => [priority, 0]),
    );
    for (const incident of this.incidentsFiltered()) {
      counts.set(incident.priority, (counts.get(incident.priority) ?? 0) + 1);
    }
    return INCIDENT_PRIORITIES.map((priority) => {
      const { label, tone } = describeIncidentPriority(priority);
      return { priority, label, tone, count: counts.get(priority) ?? 0 };
    });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const value = params.get('mockState');
      this.currentMockState = value === 'empty' || value === 'error' ? value : 'populated';
      this.load(this.currentMockState);
    });
  }

  retry(): void {
    this.load(this.currentMockState);
  }

  updateStartDate(value: string): void {
    this.startDate.set(value || null);
  }

  updateEndDate(value: string): void {
    this.endDate.set(value || null);
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

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  private inRange(date: Date): boolean {
    const start = this.parsedStart();
    const end = this.parsedEnd();
    if (start && date < start) {
      return false;
    }
    if (end && date > end) {
      return false;
    }
    return true;
  }

  private load(mockState: AdminOrdersMockState & AdminIncidentsMockState): void {
    this.status.set('loading');
    forkJoin([this.ordersService.getOrders(mockState), this.incidentsService.getIncidents(mockState)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([orders, incidents]) => {
          this.orders.set(orders);
          this.incidents.set(incidents);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
