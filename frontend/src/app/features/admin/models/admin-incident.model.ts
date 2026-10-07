import {
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  IncidentPriority,
  describeIncidentPriority,
} from '../../../shared/models/wire-enums';
import { IncidentViewModel } from '../../account/models/incident.model';
import { IncidentStatus } from '../../../shared/models/wire-enums';

export { INCIDENT_PRIORITIES, INCIDENT_STATUSES, describeIncidentPriority };
export type { IncidentPriority, IncidentStatus };

/** Backend `AdminIncidentDto` (staff view). New incidents start `ABIERTA` / `MEDIA`. */
export interface AdminIncidentDto {
  id: string;
  orderId: string;
  orderSummary: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  resolution: string | null;
  reportedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
}

export interface AdminIncidentViewModel extends IncidentViewModel {
  readonly customerEmail: string;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly priority: IncidentPriority;
  readonly updatedAt: Date;
}

export interface RegisterResolutionFormValue {
  readonly resolutionText: string;
}

/** Backend limit (`IncidentRules.RESOLUTION_MAX`), mirrored for UX validation only. */
export const RESOLUTION_MAX_LENGTH = 1000;

export function toAdminIncidentViewModel(dto: AdminIncidentDto): AdminIncidentViewModel {
  return {
    id: dto.id,
    orderId: dto.orderId,
    orderSummary: dto.orderSummary,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
    resolution: dto.resolution,
    reportedAt: new Date(dto.reportedAt),
    updatedAt: new Date(dto.updatedAt),
    resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : null,
    customerEmail: dto.customerEmail,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone,
  };
}
