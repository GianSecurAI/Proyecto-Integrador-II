import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorCode, httpStatus, withRateLimit } from '../../../../core/models/api-error.model';
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
  IncidentPriority,
  describeIncidentPriority,
} from '../../models/admin-incident.model';
import { AdminIncidentsService } from '../../services/admin-incidents.service';
import { IncidentStatus, describeIncidentStatus } from '../../../account/models/incident.model';

type LoadStatus = 'loading' | 'loaded' | 'not-found' | 'error';

/**
 * Staff incident-detail screen (`/admin/incidents/:id`) — RF-16 ("Gestión de estados de
 * incidencias")/RF-17 ("Clasificación de prioridad")/RF-18 ("Registro de resolución"). Reached
 * from `AdminIncidentListPage`. Same "no Figma frame exists, reuse the admin design system" basis
 * as that list page's doc comment.
 *
 * ROLE-AWARE UI, NOT A SECURITY BOUNDARY: the parent `/admin` route guards this screen to
 * ADMINISTRADOR/ASESOR and `canManage` only decides whether the management controls RENDER; the
 * backend (`/api/admin/incidents/**`, STAFF only) is the real authorization (Principle III).
 *
 * Backed by `GET /api/admin/incidents/{id}`, `PATCH` (status and/or priority) and
 * `POST /{id}/resolution`. `:id` is read reactively from `route.paramMap`. 404 is the not-found
 * state; other fetch failures show a retry.
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
  private readonly incidentsService = inject(AdminIncidentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionState = inject(SessionStateService);

  readonly status = signal<LoadStatus>('loading');
  readonly incident = signal<AdminIncidentViewModel | null>(null);

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

  /**
   * Statuses offered in the change-status select: exactly the server's `allowedNextStatuses`
   * minus RESUELTA, which is reachable ONLY through the resolution form/endpoint (PATCH rejects
   * it). No transition table lives in the client.
   */
  readonly otherStatuses = computed(() =>
    (this.incident()?.allowedNextStatuses ?? []).filter((s) => s !== 'RESUELTA'),
  );

  /** The server allows RESUELTA next, so the resolution form is offered. */
  readonly canResolve = computed(
    () => this.incident()?.allowedNextStatuses.includes('RESUELTA') ?? false,
  );

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
      .triage(current.id, { status: nextStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingStatus.set(false);
          this.incident.set(updated);
          this.selectedStatus.set(null);
          this.statusSuccess.set('El estado de la incidencia se actualizó correctamente.');
        },
        error: (err: unknown) => {
          this.updatingStatus.set(false);
          this.statusError.set(
            apiErrorCode(err) === 'INVALID_STATUS_TRANSITION'
              ? 'Ese cambio de estado no está permitido para la situación actual de la incidencia.'
              : withRateLimit(err, 'No pudimos actualizar el estado. Inténtalo de nuevo más tarde.'),
          );
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
      .triage(current.id, { priority: nextPriority })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.updatingPriority.set(false);
          this.incident.set(updated);
          this.selectedPriority.set(null);
          this.prioritySuccess.set('La prioridad de la incidencia se actualizó correctamente.');
        },
        error: (err: unknown) => {
          this.updatingPriority.set(false);
          this.priorityError.set(
            withRateLimit(err, 'No pudimos actualizar la prioridad. Inténtalo de nuevo más tarde.'),
          );
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
      .resolve(current.id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.registeringResolution.set(false);
          this.incident.set(updated);
          this.resolutionText.set('');
          this.resolutionSuccess.set('La resolución se registró correctamente.');
        },
        error: (err: unknown) => {
          this.registeringResolution.set(false);
          this.resolutionError.set(
            apiErrorCode(err) === 'INVALID_STATUS_TRANSITION'
              ? 'Solo una incidencia En revisión puede resolverse. Cambia primero su estado.'
              : apiErrorCode(err) === 'VALIDATION_FAILED'
                ? 'La resolución no es válida (máx. 1000 caracteres).'
                : withRateLimit(err, 'No pudimos registrar la resolución. Inténtalo de nuevo más tarde.'),
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
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (incident) => {
          this.incident.set(incident);
          this.status.set('loaded');
        },
        error: (err: unknown) => {
          this.incident.set(null);
          this.status.set(httpStatus(err) === 404 ? 'not-found' : 'error');
        },
      });
  }
}
