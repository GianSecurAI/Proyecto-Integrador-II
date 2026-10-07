import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import { IncidentStatus } from '../../../shared/models/wire-enums';
import {
  IncidentDto,
  IncidentViewModel,
  NewIncidentFormValue,
  toIncidentViewModel,
} from '../models/incident.model';

/**
 * Customer incidents: `POST /api/incidents` (register), `GET /api/incidents` (own incidents,
 * paged, optional `status` filter) and `GET /api/incidents/{id}`. The server sets status
 * `ABIERTA` and the reporter; an order that is unknown or belongs to someone else is a 404 (same
 * answer for both), at most 5 incidents may be open per order (409 CONFLICT).
 */
@Injectable({ providedIn: 'root' })
export class CustomerIncidentsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/incidents`;

  list(
    options: { status?: IncidentStatus | null; page?: number; size?: number } = {},
  ): Observable<Page<IncidentViewModel>> {
    const params = buildParams({
      status: options.status,
      page: options.page ?? 0,
      size: options.size ?? 20,
    });
    return this.http
      .get<Page<IncidentDto>>(this.url, { params })
      .pipe(map((page) => ({ ...page, content: page.content.map(toIncidentViewModel) })));
  }

  get(incidentId: string): Observable<IncidentViewModel> {
    return this.http
      .get<IncidentDto>(`${this.url}/${encodeURIComponent(incidentId)}`)
      .pipe(map(toIncidentViewModel));
  }

  register(value: NewIncidentFormValue): Observable<IncidentViewModel> {
    return this.http
      .post<IncidentDto>(this.url, {
        orderId: value.orderId,
        description: value.description.trim(),
      })
      .pipe(map(toIncidentViewModel));
  }
}
