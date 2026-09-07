import { StatusBadgeTone } from '../../../shared/ui/status-badge/status-badge.component';

/**
 * RF-03 ("Autorización por rol / gestión de roles y permisos", actor Administrador) is
 * "Confirmado" per `docs/discovery/06-system-definition.md` line 52, but explicitly "(matriz
 * rol→permiso pendiente)" — no role/permission matrix exists anywhere in the discovery docs
 * (`docs/security/security-design.md` does not exist either, confirmed absent). This screen
 * therefore does NOT build any per-permission checkbox matrix or custom-permission-set editor —
 * only the single role field the approved model actually names (line 100: "La autorización de
 * cada funcionalidad depende del rol del usuario autenticado; el detalle rol→permiso está
 * pendiente de especificación").
 *
 * Role vocabulary is the exact three Spanish values already established by
 * `SessionStateService.currentRole` (`core/services/session-state.service.ts`) and the backend
 * `Rol` enum (`backend/src/main/java/com/armakers3d/auth/domain/Rol.java`) — never the English
 * `'CUSTOMER'/'ADVISOR'/'ADMIN'` strings.
 */
export type AdminUserRole = 'CLIENTE' | 'ADMINISTRADOR' | 'ASESOR';

/** Every value of `AdminUserRole`, in a stable, deliberate display order (customer first, since
 * it is by far the most common seeded role) — used to populate both the list's role filter and
 * the detail page's role-change `<select>`. */
export const ADMIN_USER_ROLES: readonly AdminUserRole[] = ['CLIENTE', 'ASESOR', 'ADMINISTRADOR'];

const ADMIN_USER_ROLE_LABELS: Record<AdminUserRole, string> = {
  CLIENTE: 'Cliente',
  ASESOR: 'Asesor',
  ADMINISTRADOR: 'Administrador',
};

const ADMIN_USER_ROLE_TONES: Record<AdminUserRole, StatusBadgeTone> = {
  CLIENTE: 'neutral',
  ASESOR: 'info',
  ADMINISTRADOR: 'success',
};

/** Pure label+tone mapping, mirroring `describeIncidentPriority`/`describeIncidentStatus`'s exact
 * shape — no business decision, purely a presentation lookup used by both admin user pages. */
export function describeAdminUserRole(role: AdminUserRole): { label: string; tone: StatusBadgeTone } {
  return { label: ADMIN_USER_ROLE_LABELS[role], tone: ADMIN_USER_ROLE_TONES[role] };
}

/**
 * Admin-facing ViewModel for RF-03's user list/detail screens. Grounded directly in the real
 * `Cliente` JPA entity (`backend/src/main/java/com/armakers3d/auth/domain/Cliente.java`) — per
 * `docs/discovery/06-system-definition.md` line 136, "Un `Cliente` es un `Usuario` con rol
 * Cliente; Administrador/Asesor son el mismo tipo con otro rol", i.e. there is exactly ONE
 * account shape regardless of role. `Cliente.java` carries exactly `id`, `email`, `rol`,
 * `createdAt`, `active` — nothing else. This ViewModel therefore carries exactly those five
 * fields, renamed to this codebase's camelCase view-model convention
 * (`createdAt` -> `memberSince`, to read naturally as "member since" on the detail screen).
 *
 * Deliberately ABSENT: name, phone, avatar, permission list, last-login, session/MFA status, or
 * any other field — none of those exist on the approved `Usuario`/`Cliente` model, and inventing
 * one here would be exactly the kind of unapproved screen/field this feature must avoid.
 */
export interface AdminUserViewModel {
  readonly id: string;
  readonly email: string;
  readonly role: AdminUserRole;
  readonly memberSince: Date;
  /** The one approved authorization-adjacent status field (`Cliente.active`) — an
   * administratively-blocked account. No other authorization-adjacent field (session status,
   * last-login, MFA status, etc.) exists in the approved model. */
  readonly active: boolean;
}
