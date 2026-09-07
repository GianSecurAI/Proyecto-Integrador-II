import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionStateService } from '../../../../core/services/session-state.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
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

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Staff incident-detail screen (`/admin/incidents/:id`) — RF-16 ("Gestión de estados de
 * incidencias")/RF-17 ("Clasificación de prioridad")/RF-18 ("Registro de resolución"). Reached
 * from `AdminIncidentListPage`. Same "no Figma frame exists, reuse the admin design system" basis
 * as that list page's doc comment.
 *
 * ROLE-AWARE UI, NOT A SECURITY BOUNDARY (read this before touching `canManage`): the parent
 * `/admin` route already guards this whole screen to `['ADMINISTRADOR', 'ASESOR']`
 * (`app.routes.ts`), so in the current preview every visitor of this component is already one of
 * those two roles — this component-level check is defense-in-depth/UX polish only, exactly as
 * Constitution Principle III states: "the frontend is never the source of truth" for permissions
 * (`.specify/memory/constitution.md`, Principle III, "Angular Frontend Architecture" — any
 * authoritative state, explicitly including "permissions", "MAY be optimistically rendered but
 * MUST always be re-validated by the backend before it is acted upon"). Real enforcement is
 * server-side and does not exist yet (no backend `Incidencia`/staff-auth endpoint). `canManage`
 * therefore only controls whether the three management controls (status update, priority update,
 * resolution form) RENDER at all — it is not, and must never be treated as, the actual
 * authorization check for the mutations it gates.
 *
 * RF-16/RF-17/RF-18 name Administrador and Asesor identically as the actor for all three
 * capabilities — no distinction is drawn between the two roles here (unlike `admin-order.model.ts`'s
 * three ADMINISTRADOR-only children of `/admin`), since no discovery document documents one.
 *
 * `:id` is read reactively from `route.paramMap`, same "navigating between two detail routes
 * reuses this component instance" reasoning as `AdminOrderDetailPage`. An unknown id is a REAL
 * not-found state; `?mockState=error` simulates a generic fetch failure instead.
 */
@Component({
  selector: 'app-admin-incident-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CardComponent,
    ButtonComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-incident-detail.page.html',
  styleUrl: './admin-incident-detail.page.scss',
})
export class AdminIncidentDetailPage {
  private readonly incidentsService = inject(AdminIncidentsMockService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionState = inject(SessionStateService);

  readonly status = signal<LoadStatus>('loading');
  readonly incident = signal<AdminIncidentViewModel | null>(null);

  readonly allStatuses = INCIDENT_STATUSES;
  readonly allPriorities = INCIDENT_PRIORITIES;

  readonly selectedStatus = signal<IncidentStatus | null>(null);
  readonly updatingStatus = signal(false);
  readonly statusError = signal<string | null>(null);
  readonly statusSuccess = signal<string | null>(null);

  readonly selectedPriority = signal<IncidentPriority | null>(null);
  readonly updatingPriority = signal(false);
  readonly priorityError = signal<string | null>(null);
  readonly prioritySuccess = signal<string | null>(null);

  readonly resolutionText = signal('');
  readonly registeringResolution = signal(false);
  readonly resolutionError = signal<string | null>(null);
  readonly resolutionSuccess = signal<string | null>(null);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  private currentId = '';

  /** Defense-in-depth/UX-only role check — see this class's doc comment. */
  readonly canManage = computed(() => {
    const role = this.sessionState.currentRole();
    return role === 'ADMINISTRADOR' || role === 'ASESOR';
  });

  readonly otherStatuses = computed(() => {
    const current = this.incident();
    return current ? this.allStatuses.filter((s) => s !== current.status) : [];
  });

  readonly otherPriorities = computed(() => {
    const current = this.incident();
    return current ? this.allPriorities.filter((p) => p !== current.priority) : [];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.load(params.get('id') ?? '');
    });
  }

  retry(): void {
    this.load(this.currentId);
  }

  formatDate(date: Date): string {
    return this.dateFormatter.format(date);
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

  updateSelectedStatus(value: string): void {
    this.selectedStatus.set((value || null) as IncidentStatus | null);
  }

  updateSelectedPriority(value: string): void {
    this.selectedPriority.set((value || null) as IncidentPriority | null);
  }

  updateResolutionText(value: string): void {
    this.resolutionText.set(value);
  }

  submitStatusUpdate(): void {
    const current = this.incident();
    const nextStatus = this.selectedStatus();
    if (!current || !nextStatus || this.updatingStatus()) return;

    this.updatingStatus.set(true);
    this.statusError.set(null);
    this.statusSuccess.set(null);

    this.incidentsService
      .updateStatus(current.id, nextStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingStatus.set(false);
          this.incident.set(updated);
          this.selectedStatus.set(null);
          this.statusSuccess.set('El estado de la incidencia se actualizó correctamente.');
        },
        error: () => {
          this.updatingStatus.set(false);
          this.statusError.set('No pudimos actualizar el estado. Inténtalo de nuevo más tarde.');
        },
      });
  }

  submitPriorityUpdate(): void {
    const current = this.incident();
    const nextPriority = this.selectedPriority();
    if (!current || !nextPriority || this.updatingPriority()) return;

    this.updatingPriority.set(true);
    this.priorityError.set(null);
    this.prioritySuccess.set(null);

    this.incidentsService
      .updatePriority(current.id, nextPriority)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingPriority.set(false);
          this.incident.set(updated);
          this.selectedPriority.set(null);
          this.prioritySuccess.set('La prioridad de la incidencia se actualizó correctamente.');
        },
        error: () => {
          this.updatingPriority.set(false);
          this.priorityError.set('No pudimos actualizar la prioridad. Inténtalo de nuevo más tarde.');
        },
      });
  }

  submitResolution(): void {
    const current = this.incident();
    const text = this.resolutionText().trim();
    if (!current || !text || this.registeringResolution()) return;

    this.registeringResolution.set(true);
    this.resolutionError.set(null);
    this.resolutionSuccess.set(null);

    this.incidentsService
      .registerResolution(current.id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.registeringResolution.set(false);
          this.incident.set(updated);
          this.resolutionText.set('');
          this.resolutionSuccess.set('La resolución se registró correctamente.');
        },
        error: () => {
          this.registeringResolution.set(false);
          this.resolutionError.set(
            'No pudimos registrar la resolución. Inténtalo de nuevo más tarde.',
          );
        },
      });
  }

  private load(id: string): void {
    this.currentId = id;
    if (!id) {
      this.status.set('not-found');
      return;
    }
    const mockState: AdminIncidentsMockState =
      this.route.snapshot.queryParamMap.get('mockState') === 'error' ? 'error' : 'populated';
    this.status.set('loading');
    this.selectedStatus.set(null);
    this.selectedPriority.set(null);
    this.resolutionText.set('');
    this.statusError.set(null);
    this.statusSuccess.set(null);
    this.priorityError.set(null);
    this.prioritySuccess.set(null);
    this.resolutionError.set(null);
    this.resolutionSuccess.set(null);
    this.incidentsService
      .getIncidentById(id, mockState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (incident) => {
          this.incident.set(incident);
          this.status.set('loaded');
        },
        error: () => {
          this.incident.set(null);
          this.status.set(mockState === 'error' ? 'error' : 'not-found');
        },
      });
  }
}
