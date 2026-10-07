import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { buildParams } from '../../../core/http/http-params';
import { Page } from '../../../core/models/page.model';
import {
  AdminUserDto,
  AdminUserRole,
  AdminUserViewModel,
  toAdminUserViewModel,
} from '../models/admin-user.model';

export interface AdminUserQuery {
  q?: string;
  role?: AdminUserRole | null;
  active?: boolean | null;
  page?: number;
  size?: number;
  /** `createdAt` or `email`, optionally `,asc|desc`. */
  sort?: string;
}

/**
 * ADMINISTRADOR-only account administration (`/api/admin/users`): list/filter, detail, staff
 * provisioning, role change and (de)activation. The server enforces the guard rails —
 * `409 SELF_MODIFICATION_NOT_ALLOWED` (own role/deactivation), `409 LAST_ADMINISTRATOR` — and
 * revokes the target's sessions on role change/deactivation.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/users`;

  list(query: AdminUserQuery = {}): Observable<Page<AdminUserViewModel>> {
    const params = buildParams({
      q: query.q?.trim(),
      role: query.role,
      active: query.active,
      sort: query.sort,
      page: query.page ?? 0,
      size: query.size ?? 20,
    });
    return this.http
      .get<Page<AdminUserDto>>(this.url, { params })
      .pipe(map((page) => ({ ...page, content: page.content.map(toAdminUserViewModel) })));
  }

  get(id: number): Observable<AdminUserViewModel> {
    return this.http.get<AdminUserDto>(`${this.url}/${id}`).pipe(map(toAdminUserViewModel));
  }

  /** `POST /api/admin/users` — provisions a staff account (ASESOR or ADMINISTRADOR); that person
   * then signs in with the email OTP. `409` when the email already has an account. */
  createStaff(email: string, role: AdminUserRole): Observable<AdminUserViewModel> {
    return this.http
      .post<AdminUserDto>(this.url, { email: email.trim(), role })
      .pipe(map(toAdminUserViewModel));
  }

  changeRole(id: number, role: AdminUserRole): Observable<AdminUserViewModel> {
    return this.http
      .patch<AdminUserDto>(`${this.url}/${id}/role`, { role })
      .pipe(map(toAdminUserViewModel));
  }

  setActive(id: number, active: boolean): Observable<AdminUserViewModel> {
    return this.http
      .patch<AdminUserDto>(`${this.url}/${id}/active`, { active })
      .pipe(map(toAdminUserViewModel));
  }
}
