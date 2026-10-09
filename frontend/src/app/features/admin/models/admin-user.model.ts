import { ROLES, Role, describeRole } from '../../../shared/models/wire-enums';

export type AdminUserRole = Role;

export const ADMIN_USER_ROLES: readonly AdminUserRole[] = ROLES;

/** Roles an administrator may PROVISION through `POST /api/admin/users` (never CLIENTE: customers
 * register themselves with the email OTP). */
export const STAFF_PROVISION_ROLES: readonly AdminUserRole[] = [
  'ASESOR',
  'ADMINISTRADOR',
  'RESPONSABLE_TI',
];

export function describeAdminUserRole(role: AdminUserRole): {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'danger';
} {
  return describeRole(role);
}

/** Backend `AdminUserDto`. `id` is numeric, `createdAt` an ISO instant. */
export interface AdminUserDto {
  id: number;
  email: string;
  role: AdminUserRole;
  createdAt: string;
  active: boolean;
}

export interface AdminUserViewModel {
  readonly id: number;
  readonly email: string;
  readonly role: AdminUserRole;
  readonly memberSince: Date;
  readonly active: boolean;
}

export function toAdminUserViewModel(dto: AdminUserDto): AdminUserViewModel {
  return {
    id: dto.id,
    email: dto.email,
    role: dto.role,
    memberSince: new Date(dto.createdAt),
    active: dto.active,
  };
}
