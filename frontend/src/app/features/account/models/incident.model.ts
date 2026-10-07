import { IncidentStatus, describeIncidentStatus } from '../../../shared/models/wire-enums';

export { describeIncidentStatus };
export type { IncidentStatus };

/** Backend `IncidentDto` (customer view of one of their own incidents). Dates are ISO instants;
 * `resolution`/`resolvedAt` are null until the incident is resolved. */
export interface IncidentDto {
  id: string;
  orderId: string;
  orderSummary: string;
  description: string;
  status: IncidentStatus;
  resolution: string | null;
  reportedAt: string;
  resolvedAt: string | null;
}

/** View model used by the pages (dates parsed once, in `toIncidentViewModel`). */
export interface IncidentViewModel {
  readonly id: string;
  readonly orderId: string;
  readonly orderSummary: string;
  readonly description: string;
  readonly status: IncidentStatus;
  readonly resolution: string | null;
  readonly reportedAt: Date;
  readonly resolvedAt: Date | null;
}

/** Form value for `POST /api/incidents` (backend `CreateIncidentRequestDto`: `orderId`,
 * `description`). Status/priority/resolution are never client-supplied. */
export interface NewIncidentFormValue {
  readonly orderId: string;
  readonly description: string;
}

/** Backend limits (`IncidentRules`) mirrored for UX validation only. */
export const INCIDENT_DESCRIPTION_MIN = 20;
export const INCIDENT_DESCRIPTION_MAX = 1000;

export function toIncidentViewModel(dto: IncidentDto): IncidentViewModel {
  return {
    id: dto.id,
    orderId: dto.orderId,
    orderSummary: dto.orderSummary,
    description: dto.description,
    status: dto.status,
    resolution: dto.resolution,
    reportedAt: new Date(dto.reportedAt),
    resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
  };
}
