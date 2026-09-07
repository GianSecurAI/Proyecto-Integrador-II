import { StatusBadgeTone } from '../../../shared/ui/status-badge/status-badge.component';

/**
 * ASSUMPTION — incident status vocabulary (not final, pending Product Owner confirmation).
 *
 * RF-15 ("Registro de incidencias", actor Cliente) is "Confirmado" in
 * docs/discovery/06-system-definition.md (lines 219-220), but the status/priority catalog for the
 * `Incidencia` entity is explicitly left open — line 306: "Catálogo cerrado de estados y niveles
 * de prioridad de Incidencia... pendiente". The four values below are a placeholder vocabulary,
 * invented only so this frontend-only preview screen and its mock fixtures
 * (`../mocks/customer-incidents.mock.ts`) have something testable to render. This mirrors the
 * exact disclaimer pattern already used for `OrderStatus` in `./order.model.ts`, which itself
 * mirrors `specs/001-customer-otp-auth/spec.md`'s "Assumptions" section ("these values are
 * assumptions for the purpose of writing testable acceptance criteria and are not final"). A
 * future real RF-16 spec may rename, reorder, add, or remove states; nothing here is an approved
 * state machine, and no component in this feature evaluates a status *transition* rule — that
 * decision belongs entirely to a future backend (Constitution Prohibited Practice #5).
 */
export type IncidentStatus = 'abierta' | 'en_revision' | 'resuelta' | 'rechazada';

/**
 * DELIBERATELY ABSENT: a `priority` field.
 *
 * RF-17 ("Clasificación de prioridad de incidencias") is a staff-only capability — its actor is
 * Administrador/Asesor, never Cliente (docs/discovery/06-system-definition.md's RF-16/RF-17/RF-18
 * grouping). No priority levels are even defined anywhere in the discovery docs (line 306, same
 * "catálogo pendiente" note as the status vocabulary above). This customer-facing feature
 * therefore never collects, displays, or edits a priority value for an incident, at any point —
 * not as a form input, not read-only. Same reasoning excludes an "incident type/category" field:
 * grepped both discovery docs for "tipo de incidencia"/"categoría" with zero matches, so none is
 * modeled here either.
 */
export interface IncidentViewModel {
  readonly id: string;
  readonly orderId: string;
  /** Short display summary of the related order (`OrderSummaryViewModel.summary`), reused so this
   * screen never re-mocks a second, parallel order list — see
   * `../services/customer-incidents-mock.service.ts`'s mapping. */
  readonly orderSummary: string;
  readonly description: string;
  /** Always system/staff-set (RF-16), never customer-editable after creation. */
  readonly status: IncidentStatus;
  /** Staff-authored resolution text (RF-18, "Registro de resolución"). `null` until a staff member
   * resolves the incident — never fabricated client-side for an unresolved incident. */
  readonly resolution: string | null;
  readonly reportedAt: Date;
  readonly resolvedAt: Date | null;
}

/**
 * Local, submission-only form model — deliberately NOT `IncidentViewModel` (no `id`/`status`/
 * `resolution`/dates: those are always system-assigned, never customer input), same "form model
 * independent from ViewModel/persistence" discipline already established by
 * `register.page.ts`'s `RegisterFormValue` and `profile.page.ts`'s `ProfileFormValue`.
 */
export interface NewIncidentFormValue {
  readonly orderId: string;
  readonly description: string;
}

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  abierta: 'Abierta',
  en_revision: 'En revisión',
  resuelta: 'Resuelta',
  rechazada: 'Rechazada',
};

const INCIDENT_STATUS_TONES: Record<IncidentStatus, StatusBadgeTone> = {
  abierta: 'neutral',
  en_revision: 'info',
  resuelta: 'success',
  rechazada: 'danger',
};

/** Pure label+tone mapping — no business decision, purely a presentation lookup. Used by
 * `../pages/incidents/incidents.page.ts`, the only call site (no dedicated wrapper component was
 * introduced for this single usage — see that page's class doc for the rationale). */
export function describeIncidentStatus(status: IncidentStatus): {
  label: string;
  tone: StatusBadgeTone;
} {
  return { label: INCIDENT_STATUS_LABELS[status], tone: INCIDENT_STATUS_TONES[status] };
}
