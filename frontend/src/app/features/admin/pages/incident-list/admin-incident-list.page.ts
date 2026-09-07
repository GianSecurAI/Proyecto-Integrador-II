import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminDataTableComponent } from '../../components/admin-data-table/admin-data-table.component';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import {
  AdminIncidentViewModel,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  IncidentPriority,
  describeIncidentPriority,
} from '../../models/admin-incident.model';
import {
  AdminIncidentsMockService,
  AdminIncidentsMockState,
} from '../../services/admin-incidents-mock.service';
import { IncidentStatus, describeIncidentStatus } from '../../../account/models/incident.model';

type LoadStatus = 'loading' | 'loaded' | 'error';
type StatusFilter = IncidentStatus | 'todos';
type PriorityFilter = IncidentPriority | 'todos';

const STATUS_FILTER_OPTIONS: readonly StatusFilter[] = ['todos', ...INCIDENT_STATUSES];
const PRIORITY_FILTER_OPTIONS: readonly PriorityFilter[] = ['todos', ...INCIDENT_PRIORITIES];

/**
 * Staff incident list (`/admin/incidents`) — RF-16 ("Gestión de estados de incidencias")/RF-17
 * ("Clasificación de prioridad")/RF-18 ("Registro de resolución"), actor Administrador/Asesor for
 * all three (`docs/discovery/06-system-definition.md` lines 64-67). Figma has ZERO relevant frames
 * (grepped for "incidencia"/"prioridad"/"resolución", zero matches — line 261-262 independently
 * confirms RF-15/RF-16-18 both have "No existe pantalla"), so this screen reuses the existing
 * admin design system (`AdminDataTableComponent`, `AdminPageHeaderComponent`) per Constitution
 * Principle XV, exactly like `AdminOrderListPage`.
 *
 * No REST contract exists yet — `AdminIncidentsMockService` is an isolated, frontend-only preview,
 * seeded with incidents across MULTIPLE customers/orders (reusing `AdminOrdersMockService`'s
 * seeded orders for the association, never a third parallel dataset).
 * `?mockState=empty`/`?mockState=error` preview those states, same convention as every other
 * admin list.
 *
 * Filtering (by description text, status, priority) is pure local narrowing of the already-fetched
 * list — the exact "search signal + filter signal(s) + computed filtered list" approach
 * `AdminOrderListPage`/`AdminProductListPage` already established.
 */
@Component({
  selector: 'app-admin-incident-list-page',
  standalone: true,
  imports: [
    RouterLink,
    AdminPageHeaderComponent,
    AdminDataTableComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-incident-list.page.html',
  styleUrl: './admin-incident-list.page.scss',
})
export class AdminIncidentListPage {
  private readonly incidentsService = inject(AdminIncidentsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<LoadStatus>('loading');
  readonly incidents = signal<AdminIncidentViewModel[]>([]);

  /** Matches against the incident description only, per this screen's own reasonable filter
   * design (no Figma reference and no requirement dictates the exact search field). */
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly priorityFilter = signal<PriorityFilter>('todos');

  readonly statusFilterOptions = STATUS_FILTER_OPTIONS;
  readonly priorityFilterOptions = PRIORITY_FILTER_OPTIONS;

  private currentMockState: AdminIncidentsMockState = 'populated';

  readonly filteredIncidents = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    return this.incidents().filter((incident) => {
      if (status !== 'todos' && incident.status !== status) {
        return false;
      }
      if (priority !== 'todos' && incident.priority !== priority) {
        return false;
      }
      if (query && !incident.description.toLowerCase().includes(query)) {
        return false;
      }
      return true;
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

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  updatePriorityFilter(value: string): void {
    this.priorityFilter.set(value as PriorityFilter);
  }

  statusLabel(status: IncidentStatus): string {
    return describeIncidentStatus(status).label;
  }

  statusTone(status: IncidentStatus): 'neutral' | 'info' | 'success' | 'danger' {
    return describeIncidentStatus(status).tone;
  }

  priorityLabel(priority: IncidentPriority): string {
    return describeIncidentPriority(priority).label;
  }

  priorityTone(priority: IncidentPriority): 'neutral' | 'info' | 'success' | 'danger' {
    return describeIncidentPriority(priority).tone;
  }

  descriptionPreview(description: string): string {
    return description.length > 90 ? `${description.slice(0, 90)}…` : description;
  }

  private load(mockState: AdminIncidentsMockState): void {
    this.status.set('loading');
    this.incidentsService
      .getIncidents(mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (incidents) => {
          this.incidents.set(incidents);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
