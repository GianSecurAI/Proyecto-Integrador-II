import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { IncidentPriority, IncidentStatus } from '../../../shared/models/wire-enums';
import {
  AdminIncidentDto,
  AdminIncidentViewModel,
  toAdminIncidentViewModel,
} from '../models/admin-incident.model';

export interface AdminIncidentQuery {
  q?: string;
  status?: IncidentStatus | null;
  priority?: IncidentPriority | null;
  page?: number;
  size?: number;
  /** Only `reportedAt[,asc|desc]` is accepted by the backend. */
  sort?: string;
}

/**
 * Staff incident management (ASESOR and ADMINISTRADOR): `GET /api/admin/incidents` (filters and
 * paging server-side), `GET /{id}`, `PATCH /{id}` (status and/or priority) and
 * `POST /{id}/resolution`. The backend enforces the lifecycle (ABIERTA -> EN_REVISION ->
 * RESUELTA|RECHAZADA) and answers 409 INVALID_STATUS_TRANSITION otherwise; RESUELTA is only ever
 * reached through the resolution endpoint.
 */
@Injectable({ providedIn: 'root' })
export class AdminIncidentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/incidents`;

  list(query: AdminIncidentQuery = {}): Observable<Page<AdminIncidentViewModel>> {
    const params = buildParams({
      q: query.q?.trim(),
      status: query.status,
      priority: query.priority,
      sort: query.sort,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http
      .get<Page<AdminIncidentDto>>(this.url, { params })
      .pipe(map((page) => ({ ...page, content: page.content.map(toAdminIncidentViewModel) })));
  }

  get(incidentId: string): Observable<AdminIncidentViewModel> {
    return this.http
      .get<AdminIncidentDto>(`${this.url}/${encodeURIComponent(incidentId)}`)
      .pipe(map(toAdminIncidentViewModel));
  }

  /** `PATCH /api/admin/incidents/{id}` — at least one of `status` / `priority`. */
  triage(
    incidentId: string,
    change: { status?: IncidentStatus; priority?: IncidentPriority },
  ): Observable<AdminIncidentViewModel> {
    const body: { status?: IncidentStatus; priority?: IncidentPriority } = {};
    if (change.status) body.status = change.status;
    if (change.priority) body.priority = change.priority;
    return this.http
      .patch<AdminIncidentDto>(`${this.url}/${encodeURIComponent(incidentId)}`, body)
      .pipe(map(toAdminIncidentViewModel));
  }

  /** `POST /api/admin/incidents/{id}/resolution` — records the resolution and sets RESUELTA. */
  resolve(incidentId: string, resolutionText: string): Observable<AdminIncidentViewModel> {
    return this.http
      .post<AdminIncidentDto>(`${this.url}/${encodeURIComponent(incidentId)}/resolution`, {
        resolutionText: resolutionText.trim(),
      })
      .pipe(map(toAdminIncidentViewModel));
  }
}
