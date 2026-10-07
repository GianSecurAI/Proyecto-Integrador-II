import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { AdminIncidentsService } from '../../services/admin-incidents.service';
import { IncidentStatus, describeIncidentStatus } from '../../../account/models/incident.model';

type LoadStatus = 'loading' | 'loaded' | 'error';
type StatusFilter = IncidentStatus | 'todos';
type PriorityFilter = IncidentPriority | 'todos';

/** Delay before a typed search is sent to the server. */
export const INCIDENT_SEARCH_DEBOUNCE_MS = 300;

/**
 * RF-16/RF-17 staff incident list (ASESOR and ADMINISTRADOR), backed by
 * `GET /api/admin/incidents`. Search (`q`), status and priority are applied SERVER-side and the
 * result is paged by the server (default order: newest reported first).
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
  private readonly incidentsService = inject(AdminIncidentsService);

  readonly status = signal<LoadStatus>('loading');
  readonly incidents = signal<AdminIncidentViewModel[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('todos');
  readonly priorityFilter = signal<PriorityFilter>('todos');

  readonly statusFilterOptions: readonly StatusFilter[] = ['todos', ...INCIDENT_STATUSES];
  readonly priorityFilterOptions: readonly PriorityFilter[] = ['todos', ...INCIDENT_PRIORITIES];

  private request: Subscription | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  retry(): void {
    this.load();
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), INCIDENT_SEARCH_DEBOUNCE_MS);
  }

  updateStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.page.set(0);
    this.load();
  }

  updatePriorityFilter(value: string): void {
    this.priorityFilter.set(value as PriorityFilter);
    this.page.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.load();
  }

  hasActiveFilters(): boolean {
    return (
      this.search().trim() !== '' || this.statusFilter() !== 'todos' || this.priorityFilter() !== 'todos'
    );
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

  private load(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.status.set('loading');
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    this.request = this.incidentsService
      .list({
        q: this.search(),
        status: status === 'todos' ? null : status,
        priority: priority === 'todos' ? null : priority,
        page: this.page(),
      })
      .subscribe({
        next: (result) => {
          this.incidents.set(result.content);
          this.totalPages.set(result.totalPages);
          this.status.set('loaded');
        },
        error: () => this.status.set('error'),
      });
  }
}
