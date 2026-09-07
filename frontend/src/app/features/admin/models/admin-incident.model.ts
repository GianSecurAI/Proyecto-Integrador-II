import { StatusBadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { IncidentStatus, IncidentViewModel } from '../../account/models/incident.model';

/**
 * ASSUMPTION — incident priority vocabulary (not final, pending Product Owner confirmation).
 *
 * RF-17 ("Clasificación de prioridad de incidencias", actor Administrador/Asesor) is
 * "Confirmado" in `docs/discovery/06-system-definition.md` (lines 64-67), but — same as
 * `IncidentStatus` in `../../account/models/incident.model.ts` — its concrete level catalog is
 * explicitly left open (line 306: "Catálogo cerrado de estados y niveles de prioridad de
 * Incidencia... pendiente"). `'baja' | 'media' | 'alta'` is a minimal, reasonable placeholder
 * invented only so this staff-only preview screen and its mock fixtures
 * (`../mocks/admin-incidents.mock.ts`) have something testable to render. A future real RF-17
 * spec may rename, reorder, add, or remove levels; nothing here is an approved catalog, and no
 * component in this feature evaluates a priority *decision* beyond presenting the three values in
 * a `<select>` — that remains a human (Administrador/Asesor) judgment call, never a business rule
 * computed client-side (Constitution Prohibited Practice #5).
 */
export type IncidentPriority = 'baja' | 'media' | 'alta';

/** Every value of `IncidentPriority`, in ascending order — used to populate the priority-update
 * `<select>` on the detail page (`../pages/incident-detail/`) and nowhere else. */
export const INCIDENT_PRIORITIES: readonly IncidentPriority[] = ['baja', 'media', 'alta'];

/** Every value of `IncidentStatus` (reused from `../../account/models/incident.model.ts`) — used
 * to populate the status-update `<select>` on the detail page. Unlike
 * `../models/admin-order.model.ts`'s `ORDER_STATUS_TRANSITIONS`, no transition graph is invented
 * here: no discovery document defines any incident-status transition constraint (RF-16 names only
 * the capability, not a state machine), so staff may set any of the four values from any other,
 * excluding whatever the incident's current status already is. */
export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'abierta',
  'en_revision',
  'resuelta',
  'rechazada',
];

const INCIDENT_PRIORITY_LABELS: Record<IncidentPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const INCIDENT_PRIORITY_TONES: Record<IncidentPriority, StatusBadgeTone> = {
  baja: 'neutral',
  media: 'info',
  alta: 'danger',
};

/** Pure label+tone mapping, mirroring `describeIncidentStatus`'s shape exactly — no business
 * decision, purely a presentation lookup. Used by both admin incident pages. */
export function describeIncidentPriority(priority: IncidentPriority): {
  label: string;
  tone: StatusBadgeTone;
} {
  return { label: INCIDENT_PRIORITY_LABELS[priority], tone: INCIDENT_PRIORITY_TONES[priority] };
}

/**
 * Staff-scoped incident ViewModel for RF-16 ("Gestión de estados de incidencias")/RF-17
 * ("Clasificación de prioridad")/RF-18 ("Registro de resolución"), actor Administrador/Asesor for
 * all three (`docs/discovery/06-system-definition.md` lines 64-67).
 *
 * Deliberately EXTENDS (never forks) the one approved `IncidentViewModel`
 * (`../../account/models/incident.model.ts`) — that file's own "ASSUMPTION" disclaimer about the
 * status vocabulary applies equally here, and its "DELIBERATELY ABSENT: a `priority` field" doc
 * comment is exactly why `priority` is added HERE instead of there: RF-17 is staff-only, so the
 * customer-facing `IncidentViewModel` must never carry it, while this staff-facing extension must.
 * This mirrors `../models/admin-order.model.ts`'s `AdminOrderViewModel extends OrderDetailViewModel`
 * pattern precisely, including the optional `customerName`/`customerPhone` degrade-gracefully
 * fields (same "may be absent" reasoning as that file's doc comment).
 *
 * There is no separate "summary" vs. "detail" staff ViewModel here (unlike orders' `AdminOrder-
 * SummaryViewModel` vs. `AdminOrderViewModel`) — `IncidentViewModel` itself has no append-only
 * history sub-resource the way `OrderDetailViewModel` does, so one shape already suffices for both
 * the list and the detail screen, same as the customer-facing `IncidentViewModel` already being
 * used identically for both in `features/account/pages/incidents/`.
 */
export interface AdminIncidentViewModel extends IncidentViewModel {
  readonly customerEmail: string;
  readonly customerName?: string;
  readonly customerPhone?: string;
  readonly priority: IncidentPriority;
}

/**
 * Local, submission-only form model for the resolution-registration control on the detail page —
 * deliberately NOT `AdminIncidentViewModel` (no `id`/`status`/`resolvedAt`: those are always
 * system-assigned on submit, never staff input directly), same "form model independent from
 * ViewModel" discipline already established by `NewIncidentFormValue`/`RegisterFormValue`.
 *
 * The status-update and priority-update controls do NOT get an equivalent dedicated FormValue
 * type: each is a single enum `<select>`, and `AdminOrdersMockService.transitionStatus(id,
 * newStatus, note)` already established the precedent of passing that kind of single primitive
 * value directly to the service method rather than wrapping it — reserving a dedicated FormValue
 * type for the one control here that is genuinely a free-text entry.
 */
export interface RegisterResolutionFormValue {
  readonly resolutionText: string;
}
