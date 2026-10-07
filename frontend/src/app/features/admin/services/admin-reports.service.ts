import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { IncidentStatus, OrderStatus } from '../../../shared/models/wire-enums';
import { IncidentReportDto, OrderReportDto } from '../models/admin-report.model';

/**
 * ADMINISTRADOR-only reports (`/api/admin/reports/orders` and `/incidents`). The backend
 * aggregates and returns counts/amounts; nothing is computed client-side. `from`/`to` are explicit
 * `YYYY-MM-DD` calendar days (America/Lima, inclusive, at most 366 days apart).
 */
@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/reports`;

  orders(from: string, to: string, status?: OrderStatus | null): Observable<OrderReportDto> {
    return this.http.get<OrderReportDto>(`${this.url}/orders`, {
      params: buildParams({ from, to, status }),
    });
  }

  incidents(from: string, to: string, status?: IncidentStatus | null): Observable<IncidentReportDto> {
    return this.http.get<IncidentReportDto>(`${this.url}/incidents`, {
      params: buildParams({ from, to, status }),
    });
  }
}
