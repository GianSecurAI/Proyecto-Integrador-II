import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BackupOverview,
  BackupRecord,
  RegisterBackupRequest,
  SystemStatus,
} from '../models/admin-monitoring.model';

/**
 * Monitoring and backups for the IT officer and the administrator (RF-18): `GET /api/admin/monitoring`,
 * `GET /api/admin/monitoring/backups` and `POST /api/admin/monitoring/backups`.
 */
@Injectable({ providedIn: 'root' })
export class AdminMonitoringService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/monitoring`;

  status(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(this.url);
  }

  backups(): Observable<BackupOverview> {
    return this.http.get<BackupOverview>(`${this.url}/backups`);
  }

  registerBackup(request: RegisterBackupRequest): Observable<BackupRecord> {
    return this.http.post<BackupRecord>(`${this.url}/backups`, request);
  }
}
